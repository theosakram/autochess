import { Container, Graphics, GraphicsContext, Rectangle, Text, Ticker } from 'pixi.js';
import { ITEMS } from '../../game/items';
import { TRAITS } from '../../game/traits';
import { UNIT_BY_ID } from '../../game/units';
import { portraitOf } from '../portraits';
import { HERO_SVGS } from '../icons';
import { badgeSvg, BEARER_BADGES, TRAIT_BADGES, type TraitBadge } from '../traitBadges';
import { bloodStars } from '../../game/blood';
import { FORESHORTENING, WORLD } from './layout';
import { physiqueOf, PLINTHS } from './physique';
import { BLOOD_STAR, COLORS, FONT, mix, SCENE_COLORS, STAR_COLORS, TIER_COLORS } from './theme';

// A unit on the board is a game piece: a plinth on its cell (sized by build, see physique.ts) and its hero's shield
// floating above it. Drawn flat, as seen by the fixed camera (FORESHORTENING), in pixels for one cell = `size`; the
// stage scales the whole piece for its depth.

export interface TokenSpec {
  defId: string;
  star: number;
  size: number; // one cell, in pixels
  crowned?: boolean;
  leads?: string[]; // traits this unit leads; each shows its leader icon
  orb?: string | null; // trait the player's Magic Orb boosts through this unit
  mistOrbs?: string[]; // traits of the Mist orbs it holds
  marks?: string[]; // icons of the commander marks it holds (Kagura's umbrella and dance)
  itemIds?: string[];
  foe?: boolean;
  selected?: boolean;
  bars?: boolean; // hp and mana bars, for combat
  hpBar?: boolean; // just the hp bar, full: the preparation board, to compare who's tankier
  maxHp?: number; // with bars or hpBar: a divider on the hp bar every HP_TICK hp
  copies?: number; // Alice's Blood Pact hero: red stars, the last one partly filled
  merc?: boolean; // Rogue Mercenary: a briefcase in the corner
  signature?: boolean; // a hero card's hero: a medal in the corner
}

export type Bar = 'hp' | 'mana' | 'shield';

export interface TokenView {
  root: Container; // origin on the floor, at the piece's feet
  body: Container; // the floating shield, origin at its centre: status marks go here and float with it
  setBar(bar: Bar, fraction: number): void; // shield: of max hp
  flash(color: number): Graphics; // a coloured overlay at full strength; fade its alpha to animate
  ring(color: number, width: number): Graphics; // a ring on the floor around the plinth (timed buffs)
  setLift(height: number): void; // raise (or, negative, lower) the shield by a world height, on top of its float
}

const text = (value: string, size: number, fill: number, weight: '400' | '700' | '900' = '400') =>
  new Text({ text: value, style: { fontFamily: FONT, fontSize: size, fill, fontWeight: weight } });

// One parsed drawing per badge, shared by every token: a board rebuilds its tokens on each action.
const ICONS = new Map<TraitBadge, GraphicsContext>();
// A hero's face, `size` tall, centred on (0, 0): its hand-made SVG (icons/) when it has one, else its emoji.
const FACES = new Map<string, GraphicsContext>();
export function heroFace(defId: string, size: number): Container {
  const icon = HERO_SVGS[defId];
  if (!icon) {
    const t = new Text({ text: portraitOf(defId), style: { fontFamily: FONT, fontSize: size } });
    t.anchor.set(0.5);
    return t;
  }
  const holder = new Container();
  const layer = (key: string, svg: string) => {
    const g = new Graphics(FACES.get(key) ?? FACES.set(key, new GraphicsContext().svg(svg)).get(key)!);
    const b = g.getLocalBounds();
    g.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
    g.scale.set(size / Math.max(b.width, b.height, 1));
    return holder.addChild(g);
  };
  if (!icon.board) {
    layer(defId, icon.svg);
    return holder;
  }
  // Iridescent: the rim as drawn, and a white glyph whose tint cycles through the hues while it's on screen.
  layer(`${defId}:rim`, icon.board.rim);
  const ink = layer(`${defId}:ink`, icon.board.ink);
  const tint = () => (ink.tint = hueColor((performance.now() / 6000) % 1));
  // Stops itself once the face is gone (destroyed, or its token destroyed without its children).
  const shimmer = () => (ink.destroyed || !holder.parent || holder.parent.destroyed ? Ticker.shared.remove(shimmer) : tint());
  tint();
  Ticker.shared.add(shimmer);
  return holder;
}

// A bright, slightly pastel colour at `hue` (0..1 around the wheel): HSL with saturation 0.9, lightness 0.72.
function hueColor(hue: number): number {
  const s = 0.9;
  const l = 0.72;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue * 12) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return (channel(0) << 16) | (channel(8) << 8) | channel(4);
}

const iconOf = (b: TraitBadge) => ICONS.get(b) ?? ICONS.set(b, new GraphicsContext().svg(badgeSvg(b))).get(b)!;

// A round badge, centred on (0, 0): the same one the HTML side shows.
function drawBadge(b: TraitBadge, size: number): Container {
  const badge = new Container();
  const icon = new Graphics(iconOf(b));
  const scale = (size * 0.72) / 24;
  icon.scale.set(scale);
  icon.position.set(-12 * scale);
  badge.addChild(new Graphics().circle(0, 0, size / 2).fill(b.color).stroke({ width: 1, color: 0x000000, alpha: 0.5 }), icon);
  return badge;
}

// Fits a name to `maxWidth`: on two lines, then in smaller type, with an ellipsis as a last resort.
function fit(label: Text, maxWidth: number): void {
  if (label.width > maxWidth && label.text.includes(' ')) label.text = label.text.replace(/ (?=\S+$)/, '\n');
  while (label.width > maxWidth && label.style.fontSize > 7) label.style.fontSize -= 0.5;
  while (label.width > maxWidth && label.text.length > 2) label.text = `${label.text.slice(0, -2)}…`;
}

// HP per divider on a combat hp bar: big units read as big. Too crowded (under HP_TICK_GAP px apart), each
// divider stands for 5x more, drawn gold so a boss still reads as huge.
const HP_TICK = 2000;
const HP_TICK_GAP = 4;

// The hp bar (with its shield and dividers) and, with `mana`, the mana bar under it. Top edge at y = 0, centred on x.
function makeBars(width: number, hpH: number, manaH: number, opts: { mana: boolean; foe: boolean; maxHp?: number }) {
  const view = new Container();
  const bars = { hp: new Graphics(), mana: new Graphics() };
  const color = { hp: opts.foe ? COLORS.foe : COLORS.hp, mana: COLORS.mana };
  const top = { hp: 0, mana: hpH + 1 };
  const height = { hp: hpH, mana: manaH };
  const frac = { hp: 1, mana: 0, shield: 0 };
  const x0 = -width / 2;
  const draw = (bar: 'hp' | 'mana') => {
    const f = frac[bar];
    const [y, h] = [top[bar], height[bar]];
    // The shield sits right after the remaining hp. When hp + shield is more than max hp, both shrink
    // to fit, so a shield on a healthy unit still shows.
    const shield = bar === 'hp' ? frac.shield : 0;
    const scale = f + shield > 1 ? 1 / (f + shield) : 1;
    const g = bars[bar].clear().rect(x0, y, width, h).fill({ color: 0x000000, alpha: 0.55 });
    if (f > 0) g.rect(x0, y, width * f * scale, h).fill(color[bar]);
    if (shield > 0) g.rect(x0 + width * f * scale, y, width * shield * scale, h).fill(COLORS.shield);
    if (bar === 'hp' && opts.maxHp) {
      // Across hp and shield both: past max hp when the shield overflows it.
      let step = HP_TICK;
      while ((width * scale * step) / opts.maxHp < HP_TICK_GAP) step *= 5;
      for (let hp = step; hp < opts.maxHp * Math.max(1, f + shield); hp += step) g.rect(x0 + (width * scale * hp) / opts.maxHp - 1, y, 2, h);
      g.fill(step === HP_TICK ? { color: 0x000000, alpha: 0.85 } : { color: COLORS.leader, alpha: 0.9 });
    }
  };
  const setBar = (bar: Bar, fraction: number) => {
    frac[bar] = Math.max(0, Math.min(1, fraction));
    draw(bar === 'mana' ? 'mana' : 'hp');
  };
  view.addChild(bars.hp);
  if (opts.mana) view.addChild(bars.mana);
  setBar('hp', 1);
  setBar('mana', 0);
  return { view, setBar, height: opts.mana ? hpH + 1 + manaH : hpH };
}

// The star count, centred on (0, 0). Blood Pact heroes get drawn red stars, the partial one filled part way.
function makeStars(s: TokenSpec, size: number): Container {
  if (s.copies === undefined) {
    const stars = new Text({
      text: '★'.repeat(s.star),
      style: { fontFamily: FONT, fontSize: size, fill: STAR_COLORS[s.star] ?? COLORS.accent, fontWeight: '900', stroke: { color: 0x000000, width: 3 } },
    });
    stars.anchor.set(0.5);
    return stars;
  }
  const { full, frac } = bloodStars(s.copies);
  const r = size * 0.45;
  const count = full + (frac > 0 ? 1 : 0);
  const row = new Container();
  for (let i = 0; i < count; i++) {
    const fill = i < full ? 1 : frac;
    const cx = (i - (count - 1) / 2) * r * 2.05;
    const pts = starPoints(cx, 0, r);
    row.addChild(new Graphics().poly(pts).fill({ color: 0x2a0a10 }).stroke({ color: 0x000000, width: 2 }));
    const lit = new Graphics().poly(pts).fill({ color: BLOOD_STAR });
    if (fill < 1) {
      const mask = new Graphics().rect(cx - r, -r, r * 2 * fill, r * 2).fill({ color: 0xffffff });
      row.addChild(mask);
      lit.mask = mask;
    }
    row.addChild(lit, new Graphics().poly(pts).stroke({ color: 0xffb3b3, width: 1, alpha: 0.6 }));
  }
  return row;
}

// A heater shield w x h centred on (0, 0): straight top and sides, curving down to a point.
export function shieldPath(g: Graphics, w: number, h: number): Graphics {
  const [x, y] = [w / 2, h / 2];
  return g
    .moveTo(-x, -y)
    .lineTo(x, -y)
    .lineTo(x, -y * 0.1)
    .quadraticCurveTo(x, y * 0.55, 0, y)
    .quadraticCurveTo(-x, y * 0.55, -x, -y * 0.1)
    .closePath();
}

// Text icons (marks, orbs, crown, ...) the unit carries, in the order players learned to read them.
const carried = (s: TokenSpec) =>
  (s.marks ?? []).join('') +
  (s.orb ? '🔮' : '') +
  '🌫️'.repeat(s.mistOrbs?.length ?? 0) +
  (s.crowned ? '👑' : '') +
  (s.merc ? '💼' : '') +
  (s.signature ? '🏅' : '') +
  (s.leads ?? []).map((id) => TRAITS[id].leader?.icon ?? '').join('');

// Pieces this small (in pixels per cell) skip the trait badges: they'd be unreadable specks.
const BADGE_MIN_SIZE = 60;
const BOB_PERIOD_MS = 2800;

export function makeToken(s: TokenSpec): TokenView {
  const def = UNIT_BY_ID[s.defId];
  const tier = TIER_COLORS[def.tier];
  const u = s.size;
  const { floor, up } = FORESHORTENING;
  const P = WORLD.piece;
  const plinth = PLINTHS[physiqueOf(def)];
  const leads = (s.leads ?? []).length > 0;
  // In a fight, sides must read instantly: the plinth's rim and the shield's outer edge take the side's colour.
  const side = s.bars || s.foe ? (s.foe ? COLORS.foe : COLORS.ally) : null;

  const root = new Container();
  root.interactiveChildren = false; // the piece is one click/drag target (hitArea below)
  const base = new Container(); // on the floor: shadow, plinth, stars, name
  const body = new Container(); // floating: shield, face, badges, bars
  root.addChild(base, body);

  // ----- base
  const r = plinth.radius * u;
  const ry = r * floor;
  const ph = plinth.height * up * u;
  base.addChild(new Graphics().ellipse(0, 0, r * 1.2, ry * 1.2).fill({ color: 0x000000, alpha: 0.4 }));
  base.addChild(
    new Graphics()
      .ellipse(0, 0, r, ry)
      .rect(-r, -ph, r * 2, ph)
      .fill(SCENE_COLORS.plinthSide)
      .ellipse(0, -ph, r, ry)
      .fill(SCENE_COLORS.plinthTop)
      .stroke({ width: Math.max(2, u * 0.035), color: side ?? tier }),
  );
  if (s.selected) base.addChild(new Graphics().ellipse(0, -ph, r + 3, ry + 3).stroke({ width: 2.5, color: COLORS.selected }));
  const stars = makeStars(s, Math.max(10, u * 0.16));
  stars.position.set(0, -ph + ry);
  base.addChild(stars);
  // Names only while shopping: in a fight the shields and bars say enough, and labels would crowd the board.
  if (!s.bars) {
    const nameSize = Math.max(8, u * 0.12);
    const name = new Text({ text: def.name, style: { fontFamily: FONT, fontSize: nameSize, fill: COLORS.text, fontWeight: '700', align: 'center', lineHeight: nameSize * 1.05 } });
    fit(name, u * 0.95);
    name.anchor.set(0.5, 0);
    name.position.set(0, ry + 1);
    const pill = new Graphics().roundRect(-name.width / 2 - 3, ry, name.width + 6, name.height + 2, 4).fill({ color: 0x000000, alpha: 0.6 });
    base.addChild(pill, name);
  }

  // ----- body
  const restY = -P.bodyY * up * u;
  body.y = restY;
  const w = P.shieldW * u;
  const h = P.shieldH * u;
  const icon = HERO_SVGS[s.defId];
  // A soft halo in the cost colour (gold and brighter for a trait leader), the shield, then the side's edge.
  body.addChild(shieldPath(new Graphics(), w * 1.16, h * 1.12).fill({ color: leads ? COLORS.leader : tier, alpha: leads ? 0.4 : 0.18 }));
  body.addChild(
    shieldPath(new Graphics(), w, h)
      .fill(icon?.plate ?? mix(COLORS.bg, tier, 0.7))
      .stroke({ width: Math.max(2, u * 0.04), color: leads ? mix(tier, COLORS.leader, 0.6) : tier }),
  );
  if (side || s.selected) {
    body.addChild(shieldPath(new Graphics(), w + 5, h + 5).stroke({ width: s.selected ? 3 : 2, color: s.selected ? COLORS.selected : side! }));
  }
  const face = heroFace(s.defId, w * (icon ? 0.78 : 0.62));
  face.y = -h * 0.06; // the shield's point leaves less room below
  body.addChild(face);

  const small = Math.max(9, u * 0.14);
  if (u >= BADGE_MIN_SIZE) {
    const size = small * 1.2;
    [...def.traits.map((id) => TRAIT_BADGES[id]), ...(def.honorary ? [BEARER_BADGES[def.honorary.trait]] : [])].forEach((b, i) => {
      const badge = drawBadge(b, size);
      badge.position.set(-w / 2, -h / 2 + size / 2 + i * (size + 1)); // down the shield's left edge
      body.addChild(badge);
    });
  }
  const label = (value: string, x: number, y: number, ax: number, ay: number) => {
    const t = text(value, small, COLORS.text);
    t.anchor.set(ax, ay);
    t.position.set(x, y);
    body.addChild(t);
  };
  const icons = carried(s);
  if (icons) label(icons, w / 2 + 2, -h / 2, 1, 0.3);
  // Items in a row on top of the shield, under the bars.
  let itemsH = 0;
  if (s.itemIds?.length) {
    itemsH = small + 2;
    label(s.itemIds.map((id) => ITEMS[id].icon).join(''), 0, -h / 2 - 1, 0.5, 1);
  }

  let barsTop = -h / 2 - itemsH;
  let setBar: TokenView['setBar'] = () => {};
  if (s.bars || s.hpBar) {
    const bars = makeBars(w * 1.05, Math.max(4, u * 0.065), Math.max(3, u * 0.045), { mana: !!s.bars, foe: !!s.foe, maxHp: s.maxHp });
    barsTop = -h / 2 - itemsH - bars.height - 4;
    bars.view.y = barsTop;
    body.addChild(bars.view);
    setBar = bars.setBar;
  }

  const overlay = shieldPath(new Graphics(), w, h);
  overlay.alpha = 0;
  body.addChild(overlay);
  const flash = (color: number) => {
    shieldPath(overlay.clear(), w, h).fill({ color, alpha: 0.55 });
    overlay.alpha = 1;
    return overlay;
  };
  const ring = (color: number, width: number) => base.addChildAt(new Graphics().ellipse(0, 0, r * 1.45, ry * 1.45).stroke({ width, color }), 1);

  // From the bars over the shield down to the plinth's foot (and the name under it).
  const top = restY + barsTop - P.bob * up * u;
  root.hitArea = new Rectangle(-u * 0.45, top, u * 0.9, ry * 2 + small - top);

  // The idle float, out of step from piece to piece. Stops itself once the piece is gone.
  const phase = Math.random() * Math.PI * 2;
  let lift = 0;
  const bob = () => {
    if (root.destroyed) return Ticker.shared.remove(bob);
    const float = Math.sin((performance.now() / BOB_PERIOD_MS) * Math.PI * 2 + phase) * P.bob;
    body.y = restY - (lift + float) * up * u;
  };
  Ticker.shared.add(bob);

  const setLift = (height: number) => {
    lift = height;
  };

  return { root, body, setBar, flash, ring, setLift };
}

// A five-pointed star's outline around (cx, cy), outer radius r, point up.
function starPoints(cx: number, cy: number, r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  return pts;
}
