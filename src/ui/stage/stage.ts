import { markIcons, powersOf } from '../../game/commanders';
import type { Fighter } from '../../game/combat';
import { fieldStats, leadsOf } from '../../game/inventory';
import { Application, Container, Graphics, Text, type FederatedPointerEvent } from 'pixi.js';
import type { CombatEvent } from '../../game/combat';
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS, MOVE_TICKS, TICKS_PER_SECOND } from '../../game/config';
import type { Fight } from '../../game/game';
import { boardToGrid, GRID_H, GRID_W, gridIndex, viewPoint, type Point, type Side } from '../../game/grid';
import { playerTraits, traitTiles } from '../../game/traits';
import type { Loc, Player } from '../../game/types';
import { UNIT_BY_ID } from '../../game/units';
import { Actor, type Placer } from './actor';
import { vec3, type Vec3 } from './camera';
import { fireShot, flyOrb, orbit, SLASHES, sweepSlash, type FxContext } from './fx';
import { stageLayout, stageWidthForHeight, WORLD, type StageLayout } from './layout';
import { attackLook, type AttackLook } from './physique';
import { SKILL_LOOKS } from './skillFx';
import { drawBackdrop, drawBase, drawTileDetails, padTop, tileTop } from './scene';
import { COLORS, EFFECT_COLORS, FONT, SCENE_COLORS, TILE_COLORS, mix } from './theme';
import { heroFace, makeToken, type TokenView } from './token';
import { Tweens } from './tween';

const TICK_MS = 1000 / TICKS_PER_SECOND;
const RESULT_MS = 1500;
const DASH_MS = 120;
const DRAG_THRESHOLD = 5; // px of movement before a press becomes a drag
const LEAP = 0.6; // an arcing dash's peak height, in cells
const GLOW_INSET = 0.02; // floor highlights (guide, burning ground) nearly fill their cell
const DRAG_LIFT = 0.3; // a dragged piece's shield rises this high, picked up off the board

// What the prep (shopping) view shows.
export interface PrepView {
  player: Player;
  chosen: Record<string, string>;
  selectedUid: number | null;
  // A loaded lineup's plan (Team Builder): board cell -> the hero meant to stand there. Cells not yet holding
  // that hero glow gold with a thumbs up and a faint picture of who goes there.
  guide?: { cell: number; defId: string }[];
}

// The stage reports input; the app decides what it means.
export interface StageHandlers {
  unitClick(uid: number): void;
  cellClick(loc: Loc): void;
  drop(from: Loc, to: Loc | 'sell'): void;
  dragging(on: boolean): void;
}

export interface Playback {
  skip(): void;
}

// The Pixi canvas: board + bench while shopping, and fight playback.
export class Stage {
  private app = new Application();
  private layers = { cells: new Container(), units: new Container(), fx: new Container(), top: new Container() };
  private tweens = new Tweens();
  private L: StageLayout = stageLayout(400);
  private prep: PrepView | null = null;
  private fighting = false;

  private constructor(
    private host: HTMLElement,
    private on: StageHandlers,
  ) {}

  static async create(host: HTMLElement, on: StageHandlers): Promise<Stage> {
    const stage = new Stage(host, on);
    await stage.app.init({
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      width: 400,
      height: 400,
    });
    host.append(stage.app.canvas);
    stage.layers.units.sortableChildren = true; // nearer units draw over farther ones (see place)
    stage.app.stage.addChild(...Object.values(stage.layers));
    stage.app.ticker.add((ticker) => stage.tweens.update(ticker.deltaMS));
    new ResizeObserver(() => {
      // A fight keeps its layout; the next prep view picks up the new size.
      if (!stage.fighting && stage.fit() && stage.prep) stage.showPrep(stage.prep);
    }).observe(host);
    stage.fit();
    return stage;
  }

  // Matches the canvas to the host: as wide as it can be without outgrowing the host's height, so
  // the whole game stays on one screen. Returns whether the size changed.
  private fit(): boolean {
    const { clientWidth, clientHeight } = this.host;
    const width = Math.floor(clientHeight ? Math.min(clientWidth, stageWidthForHeight(clientHeight)) : clientWidth);
    if (!width || width === this.L.width) return false;
    this.L = stageLayout(width);
    this.app.renderer.resize(width, Math.ceil(this.L.height));
    return true;
  }

  private clear(): void {
    this.tweens.clear();
    for (const layer of Object.values(this.layers)) for (const child of layer.removeChildren()) child.destroy({ children: true });
  }

  // ---------- placement

  // Puts a board object at a world point: its screen position, its size at that depth (drawn at `unit` scale)
  // and its draw order, nearer over farther.
  private readonly place: Placer = (obj, at) => {
    const p = this.L.project(at);
    obj.position.set(p.x, p.y);
    obj.scale.set(p.scale / this.L.unit);
    obj.zIndex = at.z;
  };

  // Where a prep location sits in the world.
  private spot(loc: Loc): Vec3 {
    return loc.area === 'bench' ? this.L.benchWorld(loc.index) : this.L.cellWorld(boardToGrid(0, loc.index));
  }

  // The floor shape of a prep location: its tile or its pad.
  private shapeOf(loc: Loc, inset?: number): number[] {
    return loc.area === 'bench' ? padTop(this.L, loc.index) : tileTop(this.L, boardToGrid(0, loc.index), inset);
  }

  // ---------- board drawing

  // A floor shape (tile, pad or highlight), filled and optionally outlined, on the cells layer.
  private floor(points: number[], color: number, alpha = 1, outline?: { color: number; alpha: number }): Graphics {
    const g = new Graphics().poly(points).fill({ color, alpha });
    if (outline) g.stroke({ width: 1.5, color: outline.color, alpha: outline.alpha });
    this.layers.cells.addChild(g);
    return g;
  }

  // The board's body, the 7x6 grid and the bench pads. `tiles`: grid index -> trait id. In prep, your cells are
  // clickable and `targets` (empty cells a selected unit could move to) get an outline.
  private drawBoard(tiles: Map<number, string>, prep: boolean, targets: Set<string>): void {
    this.layers.cells.addChild(drawBackdrop(this.L), drawBase(this.L));
    const clickable = (g: Graphics, loc: Loc) => {
      g.eventMode = 'static';
      g.cursor = targets.has(key(loc)) ? 'pointer' : 'default';
      g.on('pointertap', () => this.on.cellClick(loc));
    };
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const tile = tiles.get(y * GRID_W + x);
        const enemyHalf = y < BOARD_ROWS;
        // Each half leans toward its side's colour, so which half is whose never needs explaining.
        const base = mix((x + y) % 2 ? COLORS.cellAlt : COLORS.cell, enemyHalf ? COLORS.foe : COLORS.ally, 0.07);
        const color = tile ? mix(base, TILE_COLORS[tile] ?? COLORS.accent, 0.3) : base;
        const loc: Loc | null = enemyHalf ? null : { area: 'board', index: (y - BOARD_ROWS) * BOARD_COLS + x };
        const outline = tile
          ? { color: TILE_COLORS[tile] ?? COLORS.accent, alpha: 0.7 }
          : loc && targets.has(key(loc))
            ? { color: COLORS.selected, alpha: 0.6 }
            : undefined;
        const g = this.floor(tileTop(this.L, { x, y }), color, prep && enemyHalf ? 0.35 : 1, outline);
        if (prep && loc) clickable(g, loc);
      }
    }
    this.layers.cells.addChild(drawTileDetails(this.L));
    for (let i = 0; i < BENCH_SIZE; i++) {
      const loc: Loc = { area: 'bench', index: i };
      const outline = targets.has(key(loc)) ? { color: COLORS.selected, alpha: 0.6 } : { color: SCENE_COLORS.padEdge, alpha: 1 };
      const g = this.floor(padTop(this.L, i), SCENE_COLORS.padTop, 1, outline);
      if (prep) clickable(g, loc);
    }
  }

  // The loaded lineup's markers, under the units: a gold glow, the planned hero faint in the middle, 👍 in the corner.
  private drawGuide(view: PrepView): void {
    const size = this.L.unit;
    for (const { cell, defId } of view.guide ?? []) {
      if (view.player.board[cell]?.defId === defId) continue; // already where it belongs
      const grid = boardToGrid(0, cell);
      const at = this.L.cellWorld(grid);
      const glow = new Graphics()
        .poly(this.shapeOf({ area: 'board', index: cell }, GLOW_INSET))
        .fill({ color: COLORS.accent, alpha: 0.16 })
        .stroke({ width: 2.5, color: COLORS.accent, alpha: 0.9 });
      const ghost = heroFace(defId, size * 0.42);
      ghost.alpha = 0.35;
      this.place(ghost, at);
      const thumb = new Text({ text: '👍', style: { fontFamily: FONT, fontSize: size * 0.24 } });
      thumb.anchor.set(1, 0);
      this.place(thumb, vec3(at.x + 0.45, at.y, at.z - 0.45)); // the cell's back right corner
      for (const g of [glow, ghost, thumb]) g.eventMode = 'none'; // clicks still reach the cell under it
      this.layers.cells.addChild(glow, ghost, thumb);
    }
  }

  // ---------- prep view

  showPrep(view: PrepView): void {
    this.prep = view;
    this.fighting = false;
    this.fit();
    this.clear();
    const p = view.player;

    const tiles = new Map<number, string>();
    for (const [cell, trait] of traitTiles(playerTraits(p))) tiles.set(gridIndex(boardToGrid(0, cell)), trait);
    // Lung's Dueling Ring.
    const ring = powersOf(p).duel;
    if (ring) tiles.set(gridIndex(boardToGrid(0, ring.cell)), 'duelring');
    const targets = new Set<string>();
    if (view.selectedUid !== null) {
      p.board.forEach((u, index) => !u && targets.add(key({ area: 'board', index })));
      p.bench.forEach((u, index) => !u && targets.add(key({ area: 'bench', index })));
    }
    this.drawBoard(tiles, true, targets);
    this.drawGuide(view);

    const crowned = new Set(Object.values(view.chosen));
    const levels = playerTraits(p);
    // Board heroes' max hp as fielded (stars, items, traits, cards): fight-start shields and buffs aren't in it.
    const stats = fieldStats(p, levels, view.chosen);
    for (const area of ['board', 'bench'] as const) {
      (area === 'board' ? p.board : p.bench).forEach((u, index) => {
        if (!u) return;
        const loc: Loc = { area, index };
        const token = makeToken({
          defId: u.defId,
          star: u.star,
          copies: u.copies,
          merc: u.merc,
          signature: u.signature,
          size: this.L.unit,
          crowned: crowned.has(u.defId),
          leads: area === 'board' ? leadsOf(p, levels, u.uid) : [],
          orb: p.orb?.defId === u.defId ? p.orb.trait : null,
          mistOrbs: (p.mistOrbs ?? []).filter((o) => o.holder === u.uid).map((o) => o.trait),
          marks: markIcons(p, u.uid),
          itemIds: p.items.filter((i) => i.holder === u.uid).map((i) => i.id),
          selected: u.uid === view.selectedUid,
          hpBar: area === 'board',
          maxHp: area === 'board' ? stats.get(u.uid)?.hp : undefined,
        });
        this.place(token.root, this.spot(loc));
        token.root.eventMode = 'static';
        token.root.cursor = 'grab';
        token.root.on('pointerdown', (e) => this.press(e, u.uid, loc, token));
        this.layers.units.addChild(token.root);
      });
    }
    // Draw now: Pixi computes world positions while rendering, and hit-testing uses them, so new
    // tokens must not wait for the next frame or a click right after a rebuild misses them.
    this.app.render();
  }

  // A press on a unit: a click if it barely moves, otherwise a drag that follows the pointer
  // (window listeners, so it works across the page and on touch) and drops on release.
  // While dragging, the piece is lifted and stands (at the right size) on the floor under the pointer, and the
  // cell or pad it would drop on lights up.
  private press(e: FederatedPointerEvent, uid: number, from: Loc, token: TokenView): void {
    const start = { x: e.clientX, y: e.clientY };
    const canvas = this.app.canvas;
    const piece = token.root;
    let dragging = false;
    const marker = new Graphics();
    marker.eventMode = 'none';
    const mark = (loc: Loc | null) => {
      marker.clear();
      if (loc) marker.poly(this.shapeOf(loc, GLOW_INSET)).fill({ color: COLORS.accent, alpha: 0.18 }).stroke({ width: 2, color: COLORS.accent, alpha: 0.9 });
    };
    const local = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const move = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD) return;
        dragging = true;
        this.layers.top.addChild(piece);
        this.layers.cells.addChild(marker);
        piece.alpha = 0.9;
        token.setLift(DRAG_LIFT);
        this.on.dragging(true);
      }
      const p = local(ev);
      const floor = this.L.floorAt(p.x, p.y);
      if (floor) this.place(piece, floor);
      else piece.position.set(p.x, p.y);
      mark(this.L.locAt(p.x, p.y));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!dragging) return this.on.unitClick(uid);
      marker.destroy();
      this.on.dragging(false);
      const overShop = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('[data-sell]');
      const p = local(ev);
      const to: Loc | 'sell' | null = overShop ? 'sell' : this.L.locAt(p.x, p.y);
      if (to && (to === 'sell' || key(to) !== key(from))) this.on.drop(from, to);
      else if (this.prep) this.showPrep(this.prep); // dropped nowhere useful: snap back
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // ---------- fight playback

  // Replays a fight's event log, viewer's side at the bottom. `onEvent` sees each event as it's
  // shown. Calls onDone once the result banner has shown (or right away when skipped twice).
  playFight(fight: Fight, viewerId: string, onEvent: (e: CombatEvent) => void, onDone: () => void, onTick: (tick: number) => void = () => {}): Playback {
    this.fighting = true;
    this.clear();
    const { result } = fight;
    const mySide: Side = fight.home === viewerId ? 0 : 1;
    const flip = mySide === 1;
    const view = (p: Point) => viewPoint(p, flip);
    const at = (p: Point, y?: number) => this.L.cellWorld(view(p), y);

    const tiles = new Map<number, string>();
    for (const side of [0, 1] as const) {
      for (const [cell, trait] of traitTiles(result.traits[side])) tiles.set(gridIndex(viewPoint(boardToGrid(side, cell), flip)), trait);
    }
    this.drawBoard(tiles, false, new Set());
    this.drawBench();

    interface View extends TokenView {
      actor: Actor;
      attack: AttackLook; // how its basic attack looks: a lean-in swing, or a shot
      maxHp: number;
      maxMana: number;
      stun?: Text;
      debuff?: Text;
      marks?: Text;
      taunt?: Text;
    }
    const views = new Map<number, View>();
    const addView = (f: Fighter) => {
      const token = makeToken({
        defId: f.defId,
        star: f.star,
        copies: f.copies,
        merc: f.merc,
        signature: f.signature,
        size: this.L.unit,
        crowned: f.chosen !== null,
        leads: f.leads,
        orb: f.orb,
        mistOrbs: f.mistOrbs,
        itemIds: f.items.map((i) => i.id),
        foe: f.side !== mySide,
        bars: true,
        maxHp: f.maxHp,
      });
      token.setBar('mana', f.mana / f.maxMana);
      this.layers.units.addChild(token.root);
      views.set(f.id, {
        ...token,
        actor: new Actor(token, at(f), this.tweens, this.place, `fighter${f.id}`),
        attack: attackLook(UNIT_BY_ID[f.defId]), maxHp: f.maxHp, maxMana: f.maxMana });
      return token;
    };
    for (const f of result.fighters) addView(f);

    const fx: FxContext = { L: this.L, tweens: this.tweens, place: this.place, air: this.layers.fx, floor: this.layers.cells };
    const actor = (id: number) => views.get(id)!.actor;
    const shieldOf = (id: number) => {
      const p = actor(id).position;
      return vec3(p.x, WORLD.piece.bodyY, p.z);
    };
    // How many hits each source has sent out this tick (by source and effect), so a volley's bolts take turns.
    const volleys = { t: -1, sent: new Map<string, number>() };
    const volleyIndex = (t: number, key: string) => {
      if (t !== volleys.t) volleys.sent.clear();
      volleys.t = t;
      const n = volleys.sent.get(key) ?? 0;
      volleys.sent.set(key, n + 1);
      return n;
    };
    const moveTo = (id: number, p: Point, ms: number, arc = 0) => actor(id).moveTo(at(p), ms, arc);
    const flash = (id: number, color: number, ms = 250) => actor(id).flash(color, ms);
    // A blow landing: the target jolts.
    const hit = (target: number, damage: number) => {
      if (damage > 0) actor(target).hop();
    };
    // A basic attack (or placeholder cast) reaching its target: a melee attacker leans into it and it lands now; a
    // ranged one fires a shot, and the blow lands (`land`) when the shot does. Hp bars don't wait: the fight's state
    // is already past the hit.
    const deliver = (by: number, target: number, swing: boolean, land: () => void) => {
      const attacker = views.get(by)!;
      if (attacker.attack === 'swing' || by === target) {
        if (swing && by !== target) attacker.actor.lunge(actor(target).position);
        return land();
      }
      const color = attacker.attack === 'bolt' ? COLORS.spell : COLORS.arrow;
      fireShot(fx, attacker.attack, shieldOf(by), shieldOf(target), color, land);
    };
    const pop = (id: number, label: string, color: number, size = 14, weight: '700' | '900' = '700') => {
      const v = views.get(id)!;
      const t = new Text({ text: label, style: { fontFamily: FONT, fontSize: size, fill: color, fontWeight: weight, stroke: { color: 0x000000, width: 3 } } });
      t.anchor.set(0.5, 1);
      // Numbers rise from the shield, not over it, so they don't cover the hp bar they changed.
      const cell = this.L.unit * v.root.scale.x; // the unit's cell size where it stands
      const from = v.body.getGlobalPosition();
      const x = from.x + (Math.random() - 0.5) * cell * 0.5;
      const y0 = from.y + cell * (0.1 + Math.random() * 0.15);
      t.position.set(x, y0);
      this.layers.fx.addChild(t);
      this.tweens.add(650, (k) => {
        t.y = y0 - 20 * k;
        t.alpha = 1 - k * k;
      }, () => t.destroy());
    };
    const setBar = (id: number, bar: 'hp' | 'mana' | 'shield', value: number) => {
      const v = views.get(id)!;
      v.setBar(bar, value / (bar === 'mana' ? v.maxMana : v.maxHp));
    };

    const stunEnds = new Map<number, number>();
    const shieldEnds = new Map<number, number>();
    const debuffEnds = new Map<number, number>();
    const tauntEnds = new Map<number, number>();
    // Timed buffs' rings, by unit and effect: taken off when the buff ends.
    const buffRings = new Map<string, { ring: Graphics; until: number }>();
    // Burning cells, by grid key: the patch drawn there and when it goes out.
    const fires = new Map<string, { patch: Graphics; until: number }>();
    const wakeUp = (all: boolean) => {
      for (const [id, until] of tauntEnds) {
        if (!all && tick < until) continue;
        views.get(id)!.taunt?.destroy();
        views.get(id)!.taunt = undefined;
        tauntEnds.delete(id);
      }
      for (const [key, b] of buffRings) {
        if (!all && tick < b.until) continue;
        if (!b.ring.destroyed) b.ring.destroy();
        buffRings.delete(key);
      }
      for (const [key, f] of fires) {
        if (!all && tick < f.until) continue;
        f.patch.destroy();
        fires.delete(key);
      }
      for (const [id, until] of debuffEnds) {
        if (!all && tick < until) continue;
        views.get(id)!.debuff?.destroy();
        views.get(id)!.debuff = undefined;
        debuffEnds.delete(id);
      }
      for (const [id, until] of shieldEnds) {
        if (!all && tick < until) continue;
        setBar(id, 'shield', 0);
        shieldEnds.delete(id);
      }
      for (const [id, until] of stunEnds) {
        if (!all && tick < until) continue;
        views.get(id)!.stun?.destroy();
        views.get(id)!.stun = undefined;
        stunEnds.delete(id);
      }
    };

    const apply = (e: CombatEvent) => {
      onEvent(e);
      switch (e.type) {
        case 'move':
          moveTo(e.id, e, MOVE_TICKS * TICK_MS);
          break;
        case 'dash': {
          const ms = e.seconds ? e.seconds * 1000 : DASH_MS;
          const from = actor(e.id).position;
          moveTo(e.id, e, ms, e.arc ? LEAP : 0);
          if (e.effect) SKILL_LOOKS[e.effect]?.dash?.(fx, { from, to: at(e), ms });
          break;
        }
        case 'attack':
        case 'cast':
          flash(e.id, e.type === 'cast' ? COLORS.mana : COLORS.selected, e.type === 'cast' ? 400 : 200);
          setBar(e.target, 'hp', e.hp);
          setBar(e.id, 'mana', e.mana);
          setBar(e.target, 'mana', e.targetMana);
          deliver(e.id, e.target, e.type === 'attack', () => {
            hit(e.target, e.damage);
            if (e.crit) pop(e.target, `${e.damage}!`, COLORS.crit, 22, '900');
            else pop(e.target, String(e.damage), e.type === 'cast' ? COLORS.spell : COLORS.text, e.type === 'cast' ? 19 : 16, '900');
          });
          break;
        case 'mana':
          for (const [id, mana] of e.mana) setBar(id, 'mana', mana);
          break;
        case 'skill':
          flash(e.id, COLORS.mana, 400);
          setBar(e.id, 'mana', 0);
          break;
        case 'effect': {
          const color = EFFECT_COLORS[e.effect] ?? COLORS.spell;
          const look = SKILL_LOOKS[e.effect];
          setBar(e.target, 'hp', e.hp);
          const land = () => {
            flash(e.target, color, 350);
            hit(e.target, e.damage);
            look?.hit?.(fx, views.get(e.target)!);
            pop(e.target, e.crit ? `${e.damage}!` : String(e.damage), e.crit ? COLORS.crit : color, e.crit ? 22 : 18, '900');
          };
          // A skill whose hits fly: the hit plays when its projectile arrives.
          if (look?.shot && e.by !== undefined && e.by !== e.target && views.has(e.by)) {
            const index = volleyIndex(e.t, `${e.by}:${e.effect}`);
            look.shot(fx, { from: shieldOf(e.by), to: shieldOf(e.target), index }, land);
          } else land();
          break;
        }
        case 'heal':
          setBar(e.id, 'hp', e.hp);
          pop(e.id, `+${e.amount}`, COLORS.heal, 16, '900');
          break;
        case 'stun': {
          const v = views.get(e.id)!;
          const icon = e.effect === 'sheep' ? '🐑' : '💫';
          if (v.stun && v.stun.text !== icon) v.stun.text = icon;
          if (!v.stun) {
            v.stun = new Text({ text: icon, style: { fontFamily: FONT, fontSize: this.L.unit * 0.22 } });
            v.stun.anchor.set(0.5);
            v.stun.position.set(this.L.unit * 0.32, -this.L.unit * 0.42);
            v.body.addChild(v.stun);
          }
          stunEnds.set(e.id, e.until);
          break;
        }
        case 'link': {
          for (const id of e.ids) {
            const mark = new Text({ text: '🔗', style: { fontFamily: FONT, fontSize: this.L.unit * 0.18 } });
            mark.anchor.set(0.5);
            mark.position.set(this.L.unit * 0.32, this.L.unit * 0.3);
            views.get(id)!.body.addChild(mark);
          }
          break;
        }
        case 'taunt': {
          const v = views.get(e.id)!;
          if (!v.taunt) {
            v.taunt = new Text({ text: '❗', style: { fontFamily: FONT, fontSize: this.L.unit * 0.22 } });
            v.taunt.anchor.set(0.5);
            v.taunt.position.set(0, -this.L.unit * 0.5);
            v.body.addChild(v.taunt);
          }
          tauntEnds.set(e.id, Math.max(tauntEnds.get(e.id) ?? 0, e.until));
          break;
        }
        case 'debuff': {
          const v = views.get(e.id)!;
          if (!v.debuff) {
            v.debuff = new Text({ text: '🔻', style: { fontFamily: FONT, fontSize: this.L.unit * 0.2 } });
            v.debuff.anchor.set(0.5);
            v.debuff.position.set(-this.L.unit * 0.32, this.L.unit * 0.3);
            v.body.addChild(v.debuff);
          }
          debuffEnds.set(e.id, Math.max(debuffEnds.get(e.id) ?? 0, e.until));
          break;
        }
        case 'shield':
          setBar(e.id, 'shield', e.amount);
          shieldEnds.set(e.id, e.until);
          break;
        case 'summon': {
          const token = addView(e.fighter);
          token.root.alpha = 0;
          this.tweens.add(300, (k) => (token.root.alpha = k));
          break;
        }
        case 'mark': {
          const v = views.get(e.id)!;
          if (!e.count) {
            v.marks?.destroy();
            v.marks = undefined;
            break;
          }
          if (!v.marks) {
            v.marks = new Text({ text: '', style: { fontFamily: FONT, fontSize: this.L.unit * 0.16, fontWeight: '900', fill: EFFECT_COLORS[e.effect] ?? COLORS.accent } });
            v.marks.anchor.set(0.5);
            v.marks.position.set(0, this.L.unit * 0.36);
            v.body.addChild(v.marks);
          }
          v.marks.text = '◆'.repeat(e.count);
          break;
        }
        case 'ground': {
          const color = EFFECT_COLORS[e.effect] ?? COLORS.spell;
          for (const c of e.cells) {
            const key = `${c.x},${c.y}`;
            const old = fires.get(key);
            if (old) old.until = Math.max(old.until, e.until);
            else {
              const patch = new Graphics().poly(tileTop(this.L, view(c), GLOW_INSET)).fill({ color, alpha: 0.45 }).stroke({ width: 3, color, alpha: 0.9 });
              this.layers.cells.addChild(patch);
              fires.set(key, { patch, until: e.until });
            }
          }
          break;
        }
        case 'piece': {
          // The commander piece appears where it stands (yours or theirs), fires, and fades away.
          const token = makeToken({ defId: e.defId, star: 1, size: this.L.unit, foe: e.side !== mySide });
          this.place(token.root, at(e));
          this.layers.units.addChild(token.root);
          this.tweens.add(900, (k) => (token.root.alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4), () => token.root.destroy());
          break;
        }
        case 'projectile': {
          const color = EFFECT_COLORS[e.effect] ?? COLORS.spell;
          const ms = Math.max(1, e.until - e.t) * TICK_MS;
          const slash = SLASHES[e.effect];
          if (slash) sweepSlash(fx, at(e.from), at(e.to), slash, color, ms);
          else flyOrb(fx, at(e.from, WORLD.piece.bodyY), at(e.to, WORLD.piece.bodyY), color, ms);
          break;
        }
        case 'orbit':
          // Orbs circling the unit, fading at the end; one turn per 16 ticks.
          orbit(fx, views.get(e.id)!, e.count, EFFECT_COLORS[e.effect] ?? COLORS.spell, (e.until - e.t) * TICK_MS, (e.until - e.t) / 16);
          break;
        case 'buff': {
          const ring = views.get(e.id)!.ring(EFFECT_COLORS[e.effect] ?? COLORS.accent, e.until ? 3 : 2);
          // One ring per unit and effect: a refreshed buff (e.g. a stack more) replaces its ring.
          const key = `${e.id}:${e.effect}`;
          buffRings.get(key)?.ring.destroy();
          buffRings.set(key, { ring, until: e.until ?? Infinity });
          break;
        }
        case 'trigger':
          // Warps snap instantly instead of sliding.
          moveTo(e.id, e, 0);
          flash(e.id, EFFECT_COLORS[e.trait] ?? COLORS.spell, 400);
          setBar(e.id, 'hp', e.hp);
          if (e.heal) pop(e.id, `+${e.heal}`, COLORS.heal, 15);
          break;
        case 'death':
          actor(e.id).die();
          break;
      }
    };

    let tick = 0;
    let next = 0;
    let finished = false;
    let doneTimer = 0;
    const timer = window.setInterval(() => {
      while (next < result.events.length && result.events[next].t <= tick) apply(result.events[next++]);
      wakeUp(false);
      onTick(tick); // the round timer
      if (++tick > result.ticks) finish();
    }, TICK_MS);

    const finish = () => {
      clearInterval(timer);
      finished = true;
      wakeUp(true);
      const won = result.winner === mySide;
      const label = result.winner === null ? 'Draw' : won ? 'Victory' : `Defeat  −${fight.damage} HP`;
      const color = result.winner === null ? COLORS.muted : won ? COLORS.hp : COLORS.foe;
      const t = new Text({ text: label, style: { fontFamily: FONT, fontSize: 26, fill: color, fontWeight: '700' } });
      t.anchor.set(0.5);
      const banner = new Container();
      banner.addChild(new Graphics().roundRect(-t.width / 2 - 28, -t.height / 2 - 12, t.width + 56, t.height + 24, 8).fill({ color: 0x000000, alpha: 0.75 }), t);
      const middle = this.L.project(vec3(0)); // the board's centre
      banner.position.set(middle.x, middle.y);
      this.layers.top.addChild(banner);
      doneTimer = window.setTimeout(onDone, RESULT_MS);
    };

    return {
      skip() {
        if (finished) {
          clearTimeout(doneTimer);
          onDone();
          return;
        }
        while (next < result.events.length) apply(result.events[next++]);
        onTick(result.ticks);
        finish();
      },
    };
  }

  // The player's bench during a fight: shown, not interactive.
  private drawBench(): void {
    if (!this.prep) return;
    this.prep.player.bench.forEach((u, index) => {
      if (!u) return;
      const token = makeToken({ defId: u.defId, star: u.star, copies: u.copies, merc: u.merc, signature: u.signature, size: this.L.unit });
      this.place(token.root, this.L.benchWorld(index));
      token.root.alpha = 0.6;
      this.layers.units.addChild(token.root);
    });
  }
}

const key = (loc: Loc) => `${loc.area}:${loc.index}`;
