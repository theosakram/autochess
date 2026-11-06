import { MANA_PER_ATTACK, MANA_PER_HIT_TAKEN, MAX_COMBAT_TICKS, MOVE_TICKS, TICKS_PER_SECOND } from './config';
import { boardToGrid, dist, GRID_H, GRID_W, gridIndex, safestCell, stepToward, type Side, type Point } from './grid';
import { activeItems, fieldStats, heldBy, leadsOf } from './inventory';
import { ITEMS } from './items';
import { nextFloat, nextInt, shuffle } from './rng';
import { SKILLS, type SkillApi } from './skills';
import { applyMods, attackInterval, type DamageType, type Stats, type StatKey, baseStats } from './stats';
import { chosenBy, playerTraits, traitPulses, traitTiles, unitOpeners, unitTriggers, type TraitLevels, type Trigger } from './traits';
import type { Player, Star } from './types';
import { UNIT_BY_ID } from './units';

// Combat runs to completion up front and returns an event log. The UI replays the
// log; a server would send the same log to clients instead of streaming state.

export interface Fighter {
  id: number;
  side: Side;
  defId: string;
  star: Star;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  onTile: boolean; // started on a trait's special tile
  chosen: string | null; // id of the trait whose chosen unit this is (and that's active for its side)
  leads: string[]; // traits it leads on its side (see TraitDef.leader)
  items: { id: string; tier: number }[]; // active items and the tier each works at
  orb: string | null; // trait its player's Magic Orb boosts through this unit type
  mistOrbs: string[]; // traits of the Mist orbs it holds
}

// Mana values are after the event, rounded for display. Regen between events isn't logged.
export type CombatEvent =
  | { t: number; type: 'move'; id: number; x: number; y: number }
  | {
      t: number;
      type: 'attack' | 'cast';
      id: number;
      target: number;
      damage: number;
      hp: number;
      mana: number;
      targetMana: number;
      crit?: true;
      again?: true; // a Fighter's extra hit
    }
  // Damage from an effect (a trait pulse, or an item's when `by` is set) rather than an attack.
  | { t: number; type: 'effect'; effect: string; by?: number; target: number; damage: number; hp: number; crit?: true }
  | { t: number; type: 'heal'; id: number; amount: number; hp: number }
  // `until` is the tick the stun wears off.
  | { t: number; type: 'stun'; id: number; by: number; until: number }
  // Units `ids` are linked by `by`: they share damage (see SkillApi.link).
  | { t: number; type: 'link'; ids: number[]; by: number }
  // Unit `id` must go after `by` until `until`.
  | { t: number; type: 'taunt'; id: number; by: number; until: number }
  // A unit appeared mid-fight, summoned by `owner` (its hits mirror the owner's, see SkillApi.summon).
  | { t: number; type: 'summon'; owner: number; fighter: Fighter }
  // Cosmetic: `count` marks from `effect` now sit on unit `id` (0 = cleared).
  | { t: number; type: 'mark'; id: number; effect: string; count: number }
  // Burning ground from `effect` on these cells until `until` (its damage comes as effect events).
  | { t: number; type: 'ground'; effect: string; cells: Point[]; until: number }
  // Cosmetic: a projectile from `from` to `to`, arriving at `until`.
  | { t: number; type: 'projectile'; effect: string; from: Point; to: Point; until: number }
  // Cosmetic: `count` orbs circle the unit until `until` (their hits are separate effect events).
  | { t: number; type: 'orbit'; id: number; effect: string; count: number; until: number }
  // Armor/mr lowered by `effect` (cast by `by`) until `until`.
  | { t: number; type: 'debuff'; id: number; by: number; effect: string; armor: number; mr: number; until: number }
  // A shield was gained or absorbed some damage: `amount` is what's left of it, gone at `until`.
  | { t: number; type: 'shield'; id: number; amount: number; until: number }
  // A unit skill went off (its hits follow as effect events with `by`).
  | { t: number; type: 'skill'; id: number; skill: string }
  // An instant reposition, e.g. a dash; drawn as a quick slide rather than a walk.
  | { t: number; type: 'dash'; id: number; x: number; y: number }
  // A lasting buff from `effect` (a trait or item id), e.g. Mooneater's column haste.
  | { t: number; type: 'buff'; id: number; by: number; effect: string; until?: number } // until: timed buffs only
  // A member's trait trigger fired: it may have warped to (x, y) and healed `heal`.
  | { t: number; type: 'trigger'; trait: string; id: number; x: number; y: number; hp: number; heal: number }
  | { t: number; type: 'death'; id: number };

export interface CombatResult {
  fighters: Fighter[]; // starting positions
  traits: [TraitLevels, TraitLevels]; // active trait levels per side
  events: CombatEvent[]; // ordered by t
  ticks: number;
  winner: Side | null; // null = draw (timeout or both boards empty)
  survivors: Fighter[]; // winner's units still standing
}

export interface SimOptions {
  chosen?: Record<string, string>; // the game's picks, GameState.chosen
  // For the balance script: switch traits off per side, or scale hp/atk.
  traits?: [boolean, boolean];
  statMult?: [number, number];
}

interface SimFighter extends Fighter {
  stats: Stats;
  shred: number; // armor and mr currently removed by enemy attacks
  dealt: number; // damage dealt so far this fight (Storm Pursuit hunts the top dealer)
  owner: number | null; // summons: who summoned it
  mirror: number; // mirror summons: share of the owner's basic attack it repeats on the same target (0: acts on its own)
  debuffs: { effect: string; armor: number; mr: number; until: number }[]; // timed, from skills
  triggers: { trait: string; trigger: Trigger; fired: boolean }[];
  pulses: { item: string; every: number; atkPct: number; type: DamageType }[]; // every in ticks
  openers: { source: string; width: number; depth: number; stunTicks: number; columnAttackSpeed: number }[];
  stunnedUntil: number;
  taunt: { by: number; until: number } | null; // must go after this unit for now
  buffs: { effect: string; mods: { stat: StatKey; add: number }[]; until: number }[]; // timed, from skills
  busyUntil: number; // a skill is using it (e.g. a rampage): no attacking or walking before this tick
  guardUntil: number; // takes less damage before this tick
  guardReduction: number;
  // Shield layers, oldest first: damage eats the newest first (see SkillApi.shield).
  shields: { effect: string; amount: number; until: number; onEnd: (() => void) | null }[];
  skill: Record<string, number>; // the unit skill's memory for this fight
  nextAttack: number;
  nextMove: number;
  target: SimFighter | null;
}

export function enemyDeaths(result: CombatResult, side: Side): number {
  const enemies = new Set(result.fighters.filter((f) => f.side !== side).map((f) => f.id));
  return result.events.filter((e) => e.type === 'death' && enemies.has(e.id)).length;
}

// Skills used (real ones and the placeholder cast) by a side's units that have `traitId`.
export function memberSkills(result: CombatResult, side: Side, traitId: string): number {
  const members = new Set(result.fighters.filter((f) => f.side === side && UNIT_BY_ID[f.defId].traits.includes(traitId)).map((f) => f.id));
  return result.events.filter((e) => (e.type === 'skill' || e.type === 'cast') && members.has(e.id)).length;
}

// Armor vs physical, mr vs magic. Negative defense amplifies damage, mirroring how positive reduces it.
export function defenseMult(defense: number): number {
  return defense >= 0 ? 100 / (100 + defense) : 2 - 100 / (100 - defense);
}

function deploy(p: Player, side: Side, levels: TraitLevels, scale: number, chosen: Record<string, string>, out: SimFighter[]): void {
  const tiles = traitTiles(levels);
  const allStats = fieldStats(p, levels, chosen, scale);
  p.board.forEach((u, cell) => {
    if (!u) return;
    const def = UNIT_BY_ID[u.defId];
    const items = activeItems(heldBy(p, u.uid), levels);
    const stats = allStats.get(u.uid)!;
    out.push({
      id: out.length,
      side,
      defId: u.defId,
      star: u.star,
      ...boardToGrid(side, cell),
      hp: stats.hp,
      maxHp: stats.hp,
      mana: 0,
      maxMana: stats.maxMana,
      onTile: tiles.has(cell),
      chosen: chosenBy(levels, chosen, u.defId),
      leads: leadsOf(p, levels, u.uid),
      items,
      orb: p.orb?.defId === u.defId ? p.orb.trait : null,
      mistOrbs: (p.mistOrbs ?? []).filter((o) => o.holder === u.uid).map((o) => o.trait),
      stats,
      shred: 0,
      dealt: 0,
      owner: null,
      mirror: 0,
      debuffs: [],
      triggers: unitTriggers(levels, def).map((tr) => ({ ...tr, fired: false })),
      pulses: items.flatMap(({ id, tier }) => {
        const pulse = ITEMS[id].pulse?.(tier);
        return pulse ? [{ item: id, every: Math.round(pulse.every * TICKS_PER_SECOND), atkPct: pulse.atkPct, type: pulse.damageType }] : [];
      }),
      openers: [
        ...items.flatMap(({ id, tier }) => {
          const opener = ITEMS[id].opener?.(tier);
          return opener ? [{ source: id, opener }] : [];
        }),
        ...unitOpeners(levels, def),
      ].map(({ source, opener: o }) => ({
        source,
        width: o.width,
        depth: o.depth,
        stunTicks: Math.round(o.stunSeconds * TICKS_PER_SECOND),
        columnAttackSpeed: o.columnAttackSpeed ?? 0,
      })),
      stunnedUntil: 0,
      taunt: null,
      buffs: [],
      busyUntil: 0,
      guardUntil: 0,
      guardReduction: 0,
      shields: stats.startShield > 0 ? [{ effect: 'startShield', amount: Math.round(stats.hp * stats.startShield), until: MAX_COMBAT_TICKS, onEnd: null }] : [],
      skill: {},
      nextAttack: Math.floor(attackInterval(stats) / 2),
      nextMove: 0,
      target: null,
    });
  });
}

const snapshot = ({ id, side, defId, star, x, y, hp, maxHp, mana, maxMana, onTile, chosen, leads, items, orb, mistOrbs }: Fighter): Fighter => ({
  id,
  side,
  defId,
  star,
  x,
  y,
  hp,
  maxHp,
  mana: Math.floor(mana),
  maxMana,
  onTile,
  chosen,
  leads,
  items,
  orb,
  mistOrbs,
});

function nearest(f: SimFighter, enemies: SimFighter[]): SimFighter {
  let best = enemies[0];
  for (const e of enemies) if (dist(f, e) < dist(f, best)) best = e;
  return best;
}

export function simulateCombat(rng: { rng: number }, home: Player, away: Player, opts: SimOptions = {}): CombatResult {
  const useTraits = opts.traits ?? [true, true];
  const scale = opts.statMult ?? [1, 1];
  const traits: CombatResult['traits'] = [
    useTraits[0] ? playerTraits(home) : {},
    useTraits[1] ? playerTraits(away) : {},
  ];

  const fighters: SimFighter[] = [];
  const chosen = opts.chosen ?? {};
  deploy(home, 0, traits[0], scale[0], chosen, fighters);
  deploy(away, 1, traits[1], scale[1], chosen, fighters);
  const start = fighters.map(snapshot);

  const occupied = new Int16Array(GRID_W * GRID_H).fill(-1);
  for (const f of fighters) occupied[gridIndex(f)] = f.id;

  const events: CombatEvent[] = [];
  const alive = (side: Side) => fighters.some((f) => f.side === side && f.hp > 0);
  // No mana while a skill keeps the unit busy, so a long skill can't chain straight into the next.
  const gainMana = (f: SimFighter, n: number) => {
    if (t < f.busyUntil) return;
    f.mana = Math.min(f.maxMana, f.mana + n);
  };

  // The one place hp goes down. `dealer` is the unit dealing it (credited for it), or null for trait damage.
  function damage(target: SimFighter, raw: number, type: DamageType, dealer: SimFighter | null): number {
    const amp = dealer ? dealer.stats.damageAmp : 0;
    const stat = type === 'physical' ? 'armor' : 'mr';
    const lowered = target.debuffs.reduce((n, d) => n + (t < d.until ? d[stat] : 0), 0);
    const defense = type === 'pure' ? 0 : target.stats[stat] - target.shred - lowered;
    const guard = t < target.guardUntil ? 1 - target.guardReduction : 1;
    const dealt = Math.round(raw * (1 + amp) * (1 + target.stats.damageTaken) * defenseMult(defense) * guard);
    // Shield layers soak it first, newest first.
    let absorbed = 0;
    const broken: (() => void)[] = [];
    for (let i = target.shields.length - 1; i >= 0 && absorbed < dealt; i--) {
      const layer = target.shields[i];
      if (t >= layer.until) continue;
      const take = Math.min(layer.amount, dealt - absorbed);
      layer.amount -= take;
      absorbed += take;
      if (layer.amount <= 0) {
        target.shields.splice(i, 1);
        if (layer.onEnd) broken.push(layer.onEnd);
      }
    }
    if (absorbed > 0) shieldEvent(target);
    target.hp = Math.max(0, target.hp - (dealt - absorbed));
    if (dealer) dealer.dealt += dealt;
    if (target.hp > 0) for (const end of broken) end();
    // Linked damage is shared once this hit has been logged (see afterDamage).
    if (dealt - absorbed > 0 && links.length) pendingShares.push({ target, taken: dealt - absorbed });
    return dealt;
  }

  // Runs after every hit: either the target dies, or it may set off its own triggers.
  function afterDamage(target: SimFighter, t: number): void {
    reactToDamage(target, t);
    flushShares();
  }

  function reactToDamage(target: SimFighter, t: number): void {
    if (target.hp > 0) checkExecute(target, t);
    if (target.hp <= 0) {
      occupied[gridIndex(target)] = -1;
      events.push({ t, type: 'death', id: target.id });
      for (const m of fighters) {
        // Mirror summons vanish with their owner; fighter summons fight on.
        if (m.owner !== target.id || m.hp <= 0 || !m.mirror) continue;
        m.hp = 0;
        occupied[gridIndex(m)] = -1;
        events.push({ t, type: 'death', id: m.id });
      }
      return;
    }
    for (const tr of target.triggers) {
      if (tr.fired || target.hp >= tr.trigger.below * target.maxHp) continue;
      tr.fired = true;
      if (tr.trigger.teleport) {
        const threats = fighters.filter((e) => e.side !== target.side && e.hp > 0);
        const to = safestCell(occupied, target, threats);
        occupied[gridIndex(target)] = -1;
        target.x = to.x;
        target.y = to.y;
        occupied[gridIndex(target)] = target.id;
      }
      const heal = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * tr.trigger.healPct));
      target.hp += heal;
      target.stats = applyMods(target.stats, tr.trigger.mods);
      events.push({ t, type: 'trigger', trait: tr.trait, id: target.id, x: target.x, y: target.y, hp: target.hp, heal });
    }
  }

  // Heals the dealer for a share of what it dealt: lifesteal on basic attacks, spell lifesteal on the rest.
  function leech(f: SimFighter, dealt: number, basicAttack: boolean, t: number): void {
    const rate = basicAttack ? f.stats.lifesteal : f.stats.spellLifesteal;
    if (rate <= 0 || f.hp <= 0) return;
    const amount = Math.min(f.maxHp - f.hp, Math.round(dealt * rate));
    if (amount <= 0) return;
    f.hp += amount;
    events.push({ t, type: 'heal', id: f.id, amount, hp: f.hp });
  }

  // A hit from a skill, credited to its caster. `basic` makes it an enhanced basic attack:
  // it can crit, applies shred and heals by lifesteal instead of spell lifesteal. Returns whether it killed.
  function skillHit(s: SimFighter, victim: SimFighter, raw: number, type: DamageType, effect: string, basic: boolean): boolean {
    if (victim.hp <= 0) return false;
    let crit = false;
    if (basic) {
      victim.shred = Math.max(victim.shred, s.stats.armorShred);
      crit = s.stats.critChance > 0 && nextFloat(rng) < s.stats.critChance;
    }
    const dealt = damage(victim, raw * (1 + s.stats.skillAmp) * (basic ? 1 + s.stats.basicAmp : 1) * (crit ? s.stats.critDamage : 1), type, s);
    events.push({ t, type: 'effect', effect, by: s.id, target: victim.id, damage: dealt, hp: victim.hp, ...(crit && { crit: true }) });
    afterDamage(victim, t);
    leech(s, dealt, basic, t);
    return victim.hp <= 0;
  }

  // Passive executes (see SkillDef.executeBelow): a living executor next to a damaged enemy that's
  // under its threshold finishes it off, ignoring shields.
  const executors = fighters.filter((f) => {
    const skill = UNIT_BY_ID[f.defId].skill;
    return skill && SKILLS[skill].executeBelow;
  });
  function checkExecute(target: SimFighter, t: number): void {
    for (const ex of executors) {
      if (ex.hp <= 0 || ex.side === target.side || dist(ex, target) > 1) continue;
      const below = SKILLS[UNIT_BY_ID[ex.defId].skill!].executeBelow![ex.star - 1];
      if (target.hp >= target.maxHp * below) continue;
      const dealt = target.hp;
      target.hp = 0;
      ex.dealt += dealt;
      events.push({ t, type: 'effect', effect: 'execute', by: ex.id, target: target.id, damage: dealt, hp: 0 });
      reactToDamage(target, t);
      return;
    }
  }

  // Damage-sharing links (see SkillApi.link), and a guard so shared damage isn't shared again.
  const links: { by: number; share: number; members: number[] }[] = [];
  let sharing = false;
  const pendingShares: { target: SimFighter; taken: number }[] = [];
  function flushShares(): void {
    while (pendingShares.length && !sharing) {
      const { target, taken } = pendingShares.shift()!;
      shareLinked(target, taken);
    }
  }
  function shareLinked(target: SimFighter, taken: number): void {
    if (sharing || taken <= 0 || !links.length) return;
    sharing = true;
    for (const link of links) {
      const source = fighters[link.by];
      if (source.hp <= 0 || !link.members.includes(target.id)) continue;
      for (const id of link.members) {
        const other = fighters[id];
        if (id === target.id || other.hp <= 0) continue;
        const dealt = damage(other, taken * link.share, 'pure', null);
        source.dealt += dealt;
        events.push({ t, type: 'effect', effect: 'fatelink', by: source.id, target: other.id, damage: dealt, hp: other.hp });
        reactToDamage(other, t);
      }
    }
    sharing = false;
    // Shared damage is never shared again.
    pendingShares.length = 0;
  }

  // The fighter whose skill is running right now, for crediting effects like debuffs.
  let casting: SimFighter | null = null;

  // What skills may do; each call goes through the same paths as attacks and effects.
  const api: SkillApi = {
    enemiesOf: (f) => fighters.filter((e) => e.side !== f.side && e.hp > 0),
    nearestEnemy: (f) => {
      const enemies = fighters.filter((e) => e.side !== f.side && e.hp > 0);
      return enemies.length ? nearest(f as SimFighter, enemies) : null;
    },
    occupant: (p) => {
      const id = occupied[gridIndex(p)];
      return id >= 0 ? fighters[id] : null;
    },
    hit: (source, target, raw, type, effect) => skillHit(fighters[source.id], fighters[target.id], raw, type, effect, false),
    basicHit: (source, target, raw, type, effect) => skillHit(fighters[source.id], fighters[target.id], raw, type, effect, true),
    safestCell: (f) => safestCell(occupied, f, fighters.filter((e) => e.side !== f.side && e.hp > 0)),
    dashTo: (who, to) => {
      const f = fighters[who.id];
      occupied[gridIndex(f)] = -1;
      f.x = to.x;
      f.y = to.y;
      occupied[gridIndex(f)] = f.id;
      events.push({ t, type: 'dash', id: f.id, x: f.x, y: f.y });
    },
    guard: (who, seconds, reduction) => {
      const f = fighters[who.id];
      f.guardUntil = t + Math.round(seconds * TICKS_PER_SECOND);
      f.guardReduction = reduction;
    },
    shield: (who, amount, seconds, effect, onEnd) => {
      const f = fighters[who.id];
      // Its own older layer is replaced: that one ends here.
      const old = f.shields.findIndex((l) => l.effect === effect);
      if (old >= 0) {
        const [layer] = f.shields.splice(old, 1);
        if (layer.onEnd && f.hp > 0) layer.onEnd();
      }
      f.shields.push({ effect, amount: Math.round(amount), until: t + Math.round(seconds * TICKS_PER_SECOND), onEnd: onEnd ?? null });
      shieldEvent(f);
    },
    buff: (who, mods, seconds, effect, by) => {
      const f = fighters[who.id];
      const until = seconds === Infinity ? Infinity : t + Math.round(seconds * TICKS_PER_SECOND);
      const old = f.buffs.findIndex((b) => b.effect === effect);
      if (old >= 0) {
        // Refresh: take the old one off before putting the new one on.
        f.stats = applyMods(f.stats, f.buffs[old].mods.map((m) => ({ stat: m.stat, add: -m.add })));
        f.buffs.splice(old, 1);
      }
      f.stats = applyMods(f.stats, mods);
      f.buffs.push({ effect, mods, until });
      events.push({ t, type: 'buff', id: f.id, by: by.id, effect, ...(until !== Infinity && { until }) });
    },
    alliesOf: (f) => fighters.filter((e) => e.side === f.side && e.hp > 0),
    random: (n) => nextInt(rng, n),
    giveMana: (who, amount) => gainMana(fighters[who.id], amount),
    counterAttack: (who, at) => {
      const f = fighters[who.id];
      const target = fighters[at.id];
      if (countering || f.hp <= 0 || target.hp <= 0) return;
      countering = true;
      fullBasicAttack(f, target, t);
      countering = false;
    },
    dropAggro: (who) => {
      for (const f of fighters) if (f.target?.id === who.id && f.side !== who.side) f.target = null;
    },
    link: (by, targets, share) => {
      const group = { by: by.id, share, members: targets.map((x) => x.id) };
      links.push(group);
      events.push({ t, type: 'link', ids: group.members, by: by.id });
    },
    taunt: (who, by, seconds) => {
      const f = fighters[who.id];
      if (f.hp <= 0) return;
      const until = t + Math.round(seconds * TICKS_PER_SECOND);
      f.taunt = { by: by.id, until };
      f.target = fighters[by.id];
      events.push({ t, type: 'taunt', id: f.id, by: by.id, until });
    },
    stun: (who, seconds, by) => {
      const f = fighters[who.id];
      const until = t + Math.round(seconds * TICKS_PER_SECOND);
      if (f.hp <= 0 || until <= f.stunnedUntil) return;
      f.stunnedUntil = until;
      events.push({ t, type: 'stun', id: f.id, by: by.id, until });
    },
    heal: (who, amount) => {
      const f = fighters[who.id];
      const healed = Math.min(f.maxHp - f.hp, Math.round(amount));
      if (f.hp <= 0 || healed <= 0) return 0;
      f.hp += healed;
      events.push({ t, type: 'heal', id: f.id, amount: healed, hp: f.hp });
      return healed;
    },
    minionsOf: (f) => fighters.filter((m) => m.owner === f.id && m.hp > 0),
    summon: (who, defId, { hpShare, mirror, atk, at }) => {
      const owner = fighters[who.id];
      const around = at ?? owner;
      let cell: Point | null = null;
      // The spot itself if it's free (a drop), else the nearest free cell beside it.
      if (at && occupied[gridIndex(at)] < 0) cell = { x: at.x, y: at.y };
      for (let dx = -1; dx <= 1 && !cell; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const p = { x: around.x + dx, y: around.y + dy };
          if ((!dx && !dy) || p.x < 0 || p.y < 0 || p.x >= GRID_W || p.y >= GRID_H || occupied[gridIndex(p)] >= 0) continue;
          if (!cell || dist(around, p) < dist(around, cell)) cell = p;
        }
      }
      if (!cell) return null;
      const hp = Math.max(1, Math.round(owner.maxHp * hpShare));
      const independent = !mirror;
      const base = baseStats(UNIT_BY_ID[defId], owner.star);
      // A fighter summon without a skill never casts: its mana bar never fills.
      const silent = independent && !UNIT_BY_ID[defId].skill;
      const stats = { ...base, hp, ...(atk !== undefined && { atk: Math.round(atk), ap: Math.round(atk) }), ...(silent && { maxMana: Infinity }) };
      const m: SimFighter = {
        id: fighters.length,
        side: owner.side,
        defId,
        star: owner.star,
        x: cell.x,
        y: cell.y,
        hp,
        maxHp: hp,
        mana: 0,
        maxMana: stats.maxMana,
        onTile: false,
        chosen: null,
        leads: [],
        items: [],
        orb: null,
        mistOrbs: [],
        stats,
        shred: 0,
        dealt: 0,
        owner: owner.id,
        mirror: mirror ?? 0,
        debuffs: [],
        triggers: [],
        pulses: [],
        openers: [],
        stunnedUntil: 0,
        taunt: null,
        buffs: [],
        busyUntil: independent ? 0 : Infinity, // a mirror never acts on its own: it only repeats its owner's hits
        guardUntil: 0,
        guardReduction: 0,
        shields: [],
        skill: {},
        nextAttack: independent ? t + Math.floor(attackInterval(stats) / 2) : Infinity,
        nextMove: independent ? t : Infinity,
        target: null,
      };
      fighters.push(m);
      occupied[gridIndex(m)] = m.id;
      events.push({ t, type: 'summon', owner: owner.id, fighter: snapshot(m) });
      return m;
    },
    hasBuff: (who, effect) => fighters[who.id].buffs.some((b) => b.effect === effect && t < b.until),
    unbuff: (who, effect) => {
      const f = fighters[who.id];
      for (const b of f.buffs.filter((b) => b.effect === effect)) f.stats = applyMods(f.stats, b.mods.map((m) => ({ stat: m.stat, add: -m.add })));
      f.buffs = f.buffs.filter((b) => b.effect !== effect);
    },
    showMarks: (who, count, effect) => {
      events.push({ t, type: 'mark', id: who.id, effect, count });
    },
    busy: (who, on) => {
      fighters[who.id].busyUntil = on ? Infinity : 0;
    },
    burn: (source, cells, perSecond, type, seconds, effect) => {
      const until = t + Math.round(seconds * TICKS_PER_SECOND);
      for (const c of cells) {
        const key = `${source.side}:${c.x},${c.y}`;
        ground.set(key, { source: fighters[source.id], x: c.x, y: c.y, perSecond, type, until, effect });
      }
      events.push({ t, type: 'ground', effect, cells: cells.map(({ x, y }) => ({ x, y })), until });
    },
    showProjectile: (from, to, seconds, effect) => {
      events.push({ t, type: 'projectile', effect, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, until: t + Math.round(seconds * TICKS_PER_SECOND) });
    },
    showOrbit: (who, count, seconds, effect) => {
      events.push({ t, type: 'orbit', id: who.id, effect, count, until: t + Math.round(seconds * TICKS_PER_SECOND) });
    },
    attackPower: (who) => {
      const f = fighters[who.id];
      const type = UNIT_BY_ID[f.defId].attackType ?? 'physical';
      return { amount: type === 'magic' ? f.stats.ap : f.stats.atk, type };
    },
    debuff: (who, amount, seconds, effect) => {
      const f = fighters[who.id];
      const until = t + Math.round(seconds * TICKS_PER_SECOND);
      const entry = { effect, armor: amount.armor ?? 0, mr: amount.mr ?? 0, until };
      const at = f.debuffs.findIndex((d) => d.effect === effect);
      if (at >= 0) f.debuffs[at] = entry;
      else f.debuffs.push(entry);
      events.push({ t, type: 'debuff', id: f.id, by: casting?.id ?? -1, effect, armor: entry.armor, mr: entry.mr, until });
    },
    repeat: (who, seconds, times, fn) => {
      const every = Math.max(1, Math.round(seconds * TICKS_PER_SECOND));
      repeats.push({ f: fighters[who.id], every, next: t + every, left: times, fn });
    },
  };

  // The UI sees one shield: the layers' total, gone when the last one runs out.
  function shieldEvent(f: SimFighter): void {
    const live = f.shields.filter((l) => t < l.until);
    const amount = live.reduce((n, l) => n + l.amount, 0);
    const until = live.reduce((n, l) => Math.max(n, l.until), t);
    events.push({ t, type: 'shield', id: f.id, amount, until });
  }
  // Layers that run out are removed, running their end effect (not for the dead).
  function expireShields(t: number): void {
    for (const f of fighters) {
      const done = f.shields.filter((l) => t >= l.until);
      if (!done.length) continue;
      f.shields = f.shields.filter((l) => t < l.until);
      shieldEvent(f);
      if (f.hp > 0) for (const l of done) l.onEnd?.();
    }
  }

  // Timed buffs come off when they run out.
  function expireBuffs(t: number): void {
    for (const f of fighters) {
      if (!f.buffs.length) continue;
      for (const b of f.buffs.filter((b) => t >= b.until)) f.stats = applyMods(f.stats, b.mods.map((m) => ({ stat: m.stat, add: -m.add })));
      f.buffs = f.buffs.filter((b) => t < b.until);
    }
  }

  // Burning cells (see SkillApi.burn), keyed by side and cell so re-burning refreshes.
  const ground = new Map<string, { source: SimFighter; x: number; y: number; perSecond: number; type: DamageType; until: number; effect: string }>();
  const GROUND_EVERY = Math.round(TICKS_PER_SECOND / 2);
  function fireGround(t: number): void {
    if (t % GROUND_EVERY !== 0) return;
    for (const [key, g] of ground) {
      if (t >= g.until) {
        ground.delete(key);
        continue;
      }
      const id = occupied[gridIndex(g)];
      const victim = id >= 0 ? fighters[id] : null;
      if (victim && victim.side !== g.source.side) skillHit(g.source, victim, g.perSecond / 2, g.type, g.effect, false);
    }
  }

  // Skill effects that keep going after the cast (see SkillApi.repeat).
  const repeats: { f: SimFighter; every: number; next: number; left: number; fn: () => void }[] = [];
  function fireRepeats(t: number): void {
    for (const r of repeats) {
      if (r.left <= 0 || r.next !== t) continue;
      if (r.f.hp <= 0) {
        r.left = 0;
        continue;
      }
      r.fn();
      r.left--;
      r.next += r.every;
    }
    for (let i = repeats.length - 1; i >= 0; i--) if (repeats[i].left <= 0) repeats.splice(i, 1);
  }

  function strike(f: SimFighter, target: SimFighter, t: number): void {
    const cast = f.mana >= f.maxMana;
    const skill = cast ? UNIT_BY_ID[f.defId].skill : undefined;
    if (skill) {
      f.mana = 0;
      events.push({ t, type: 'skill', id: f.id, skill });
      casting = f;
      SKILLS[skill].cast(api, f, target);
      casting = null;
    } else if (cast) {
      const dealt = damage(target, f.stats.ap * f.stats.castMult * (1 + f.stats.skillAmp), 'magic', f);
      f.mana = 0;
      hitEvent(f, target, t, 'cast', dealt, false);
      leech(f, dealt, false, t);
    } else {
      fullBasicAttack(f, target, t);
    }
    f.nextAttack = t + attackInterval(f.stats);
  }

  // A basic attack plus Fighter's chance to hit again.
  function fullBasicAttack(f: SimFighter, target: SimFighter, t: number): void {
    basicAttack(f, target, t, false);
    // Only roll when there's a chance, so fights without it replay exactly as before.
    if (target.hp > 0 && f.hp > 0 && f.stats.hitAgain > 0 && nextFloat(rng) < f.stats.hitAgain) basicAttack(f, target, t, true);
  }

  // True while a counter-attack is resolving, so counters never set off more counters.
  let countering = false;

  function basicAttack(f: SimFighter, target: SimFighter, t: number, again: boolean): void {
    // Shred lands before the damage, so the first hit already benefits.
    target.shred = Math.max(target.shred, f.stats.armorShred);
    // Only roll when there's a chance, so crit-free fights replay exactly as before crits existed.
    const crit = f.stats.critChance > 0 && nextFloat(rng) < f.stats.critChance;
    // Physical attackers hit with attack, magic attackers with magic attack.
    const type = UNIT_BY_ID[f.defId].attackType ?? 'physical';
    const power = type === 'magic' ? f.stats.ap : f.stats.atk;
    const dealt = damage(target, power * (1 + f.stats.basicAmp) * (crit ? f.stats.critDamage : 1), type, f);
    gainMana(f, MANA_PER_ATTACK);
    hitEvent(f, target, t, 'attack', dealt, crit, again);
    leech(f, dealt, true, t);
    // Its summons repeat the hit on the same target, crit and all. They copy the hit itself, not the
    // owner's damage bonuses (those are the owner's alone).
    for (const m of fighters) {
      if (m.owner !== f.id || !m.mirror || m.hp <= 0 || target.hp <= 0) continue;
      const raw = power * (1 + f.stats.basicAmp) * m.mirror * (crit ? f.stats.critDamage : 1);
      hitEvent(m, target, t, 'attack', damage(target, raw, type, m), crit, again);
    }
    const skill = UNIT_BY_ID[f.defId].skill;
    if (skill) SKILLS[skill].onBasicHit?.(api, f, target);
    const theirs = UNIT_BY_ID[target.defId].skill;
    if (theirs && !countering && target.hp > 0) SKILLS[theirs].onAttacked?.(api, target, f);
  }

  // Logs an attack or placeholder cast, then lets the target react (mana, death, triggers).
  function hitEvent(f: SimFighter, target: SimFighter, t: number, type: 'attack' | 'cast', dealt: number, crit: boolean, again = false): void {
    gainMana(target, MANA_PER_HIT_TAKEN);
    events.push({
      t,
      type,
      id: f.id,
      target: target.id,
      damage: dealt,
      hp: target.hp,
      mana: Math.floor(f.mana),
      targetMana: Math.floor(target.mana),
      ...(crit && { crit: true }),
      ...(again && { again: true }),
    });
    afterDamage(target, t);
  }

  // Trait pulses: each side's fire on the tick they're due, hitting every living enemy.
  const pulses = ([0, 1] as const).flatMap((side) =>
    traitPulses(traits[side]).map(({ trait, pulse }) => ({ side, trait, pulse, every: Math.round(pulse.every * TICKS_PER_SECOND) })),
  );
  function firePulses(t: number): void {
    for (const { side, trait, pulse, every } of pulses) {
      if (t === 0 || t % every !== 0 || t / every > pulse.times) continue;
      for (const target of fighters) {
        if (target.side === side || target.hp <= 0) continue;
        const dealt = damage(target, target.maxHp * pulse.pctMaxHp, pulse.damageType, null);
        events.push({ t, type: 'effect', effect: trait, target: target.id, damage: dealt, hp: target.hp });
        afterDamage(target, t);
      }
    }
  }

  // Item pulses (e.g. Keris' Mortal Strike): from a living holder, hitting every living enemy.
  // They fire even while the holder is stunned.
  function fireItemPulses(t: number): void {
    if (t === 0) return;
    for (const f of fighters) {
      for (const pulse of f.pulses) {
        if (f.hp <= 0 || t % pulse.every !== 0) continue;
        for (const target of fighters) {
          if (target.side === f.side || target.hp <= 0) continue;
          const dealt = damage(target, f.stats.atk * pulse.atkPct, pulse.type, f);
          events.push({ t, type: 'effect', effect: pulse.item, by: f.id, target: target.id, damage: dealt, hp: target.hp });
          afterDamage(target, t);
          leech(f, dealt, false, t);
        }
      }
    }
  }

  // Battle-start effects: stun enemies in an area in front of each carrier (toward the enemy half),
  // then haste every ally in a carrier's column (one bonus per column, the biggest).
  function fireOpeners(): void {
    const haste = new Map<string, { bonus: number; by: number; source: string }>();
    for (const f of fighters) {
      for (const o of f.openers) {
        const forward = f.side === 0 ? -1 : 1;
        const left = Math.floor((o.width - 1) / 2);
        const column = `${f.side}:${f.x}`;
        if (o.columnAttackSpeed > (haste.get(column)?.bonus ?? 0)) haste.set(column, { bonus: o.columnAttackSpeed, by: f.id, source: o.source });
        for (let dy = 1; dy <= Math.min(o.depth, GRID_H); dy++) {
          for (let dx = -left; dx < o.width - left; dx++) {
            const p = { x: f.x + dx, y: f.y + forward * dy };
            if (p.x < 0 || p.y < 0 || p.x >= GRID_W || p.y >= GRID_H) continue;
            const id = occupied[gridIndex(p)];
            const target = id >= 0 ? fighters[id] : null;
            if (!target || target.side === f.side || o.stunTicks <= target.stunnedUntil) continue;
            target.stunnedUntil = o.stunTicks;
            events.push({ t: 0, type: 'stun', id: target.id, by: f.id, until: o.stunTicks });
          }
        }
      }
    }
    for (const ally of fighters) {
      const h = haste.get(`${ally.side}:${ally.x}`);
      if (!h) continue;
      ally.stats = applyMods(ally.stats, [{ stat: 'attackSpeed', add: h.bonus }]);
      events.push({ t: 0, type: 'buff', id: ally.id, by: h.by, effect: h.source });
    }
  }

  function advance(f: SimFighter, target: SimFighter, t: number): void {
    const step = stepToward(occupied, f, target, f.stats.range);
    if (!step) return;
    occupied[gridIndex(f)] = -1;
    f.x = step.x;
    f.y = step.y;
    occupied[gridIndex(f)] = f.id;
    events.push({ t, type: 'move', id: f.id, x: f.x, y: f.y });
    f.nextMove = t + MOVE_TICKS;
    // No attacking mid-stride.
    f.nextAttack = Math.max(f.nextAttack, t + MOVE_TICKS);
  }

  // The fight clock, in ticks. Declared before fight-start effects so skill passives can read it.
  let t = 0;
  for (const f of fighters) if (f.shields.length) shieldEvent(f);
  if (alive(0) && alive(1)) {
    fireOpeners();
    // Skill passives, from the starting positions.
    for (const f of fighters) {
      const skill = UNIT_BY_ID[f.defId].skill;
      if (skill) SKILLS[skill].atStart?.(api, f);
    }
  }

  for (; t < MAX_COMBAT_TICKS && alive(0) && alive(1); t++) {
    for (const f of fighters) if (f.hp > 0) gainMana(f, f.stats.manaRegen / TICKS_PER_SECOND);
    firePulses(t);
    fireItemPulses(t);
    fireRepeats(t);
    fireGround(t);
    expireBuffs(t);
    expireShields(t);

    // Shuffled each tick so neither side always strikes first.
    for (const f of shuffle(rng, fighters.filter((f) => f.hp > 0))) {
      if (f.hp <= 0 || t < f.stunnedUntil || t < f.busyUntil) continue;
      const enemies = fighters.filter((e) => e.side !== f.side && e.hp > 0);
      if (enemies.length === 0) break;

      // A taunted unit goes after its taunter; otherwise it sticks with its target while alive and in range.
      const taunter = f.taunt && t < f.taunt.until ? fighters[f.taunt.by] : null;
      if (taunter && taunter.hp > 0) f.target = taunter;
      else if (!f.target || f.target.hp <= 0 || dist(f, f.target) > f.stats.range) f.target = nearest(f, enemies);
      const target = f.target;

      if (dist(f, target) <= f.stats.range) {
        if (t >= f.nextAttack) strike(f, target, t);
      } else if (t >= f.nextMove) {
        advance(f, target, t);
      }
    }
  }

  const a0 = alive(0);
  const a1 = alive(1);
  const winner: Side | null = a0 && !a1 ? 0 : a1 && !a0 ? 1 : null;
  // Summons don't count toward the damage the loser takes.
  const survivors = winner === null ? [] : fighters.filter((f) => f.side === winner && f.hp > 0 && f.owner === null).map(snapshot);
  return { fighters: start, traits, events, ticks: t, winner, survivors };
}
