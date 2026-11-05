import { MANA_PER_ATTACK, MANA_PER_HIT_TAKEN, MAX_COMBAT_TICKS, MOVE_TICKS, TICKS_PER_SECOND } from './config';
import { boardToGrid, dist, GRID_H, GRID_W, gridIndex, safestCell, stepToward, type Side, type Point } from './grid';
import { activeItems, fieldStats, heldBy, leadsOf } from './inventory';
import { ITEMS } from './items';
import { nextFloat, shuffle } from './rng';
import { SKILLS, type SkillApi } from './skills';
import { applyMods, attackInterval, type DamageType, type Stats, type StatKey } from './stats';
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
  // Cosmetic: `count` marks from `effect` now sit on unit `id` (0 = cleared).
  | { t: number; type: 'mark'; id: number; effect: string; count: number }
  // Burning ground from `effect` on these cells until `until` (its damage comes as effect events).
  | { t: number; type: 'ground'; effect: string; cells: Point[]; until: number }
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
  debuffs: { effect: string; armor: number; mr: number; until: number }[]; // timed, from skills
  triggers: { trait: string; trigger: Trigger; fired: boolean }[];
  pulses: { item: string; every: number; atkPct: number; type: DamageType }[]; // every in ticks
  openers: { source: string; width: number; depth: number; stunTicks: number; columnAttackSpeed: number }[];
  stunnedUntil: number;
  buffs: { effect: string; mods: { stat: StatKey; add: number }[]; until: number }[]; // timed, from skills
  busyUntil: number; // a skill is using it (e.g. a rampage): no attacking or walking before this tick
  guardUntil: number; // takes less damage before this tick
  guardReduction: number;
  shield: number; // damage it absorbs before hp, until shieldUntil
  shieldUntil: number;
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
      stats,
      shred: 0,
      dealt: 0,
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
      buffs: [],
      busyUntil: 0,
      guardUntil: 0,
      guardReduction: 0,
      shield: Math.round(stats.hp * stats.startShield),
      shieldUntil: stats.startShield > 0 ? MAX_COMBAT_TICKS : 0,
      skill: {},
      nextAttack: Math.floor(attackInterval(stats) / 2),
      nextMove: 0,
      target: null,
    });
  });
}

const snapshot = ({ id, side, defId, star, x, y, hp, maxHp, mana, maxMana, onTile, chosen, leads, items, orb }: Fighter): Fighter => ({
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
    const dealt = Math.round(raw * (1 + amp) * defenseMult(defense) * guard);
    const absorbed = t < target.shieldUntil ? Math.min(target.shield, dealt) : 0;
    if (absorbed > 0) {
      target.shield -= absorbed;
      events.push({ t, type: 'shield', id: target.id, amount: target.shield, until: target.shieldUntil });
    }
    target.hp = Math.max(0, target.hp - (dealt - absorbed));
    if (dealer) dealer.dealt += dealt;
    return dealt;
  }

  // Runs after every hit: either the target dies, or it may set off its own triggers.
  function afterDamage(target: SimFighter, t: number): void {
    if (target.hp <= 0) {
      occupied[gridIndex(target)] = -1;
      events.push({ t, type: 'death', id: target.id });
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
    shield: (who, amount, seconds) => {
      const f = fighters[who.id];
      f.shield = Math.round(amount);
      f.shieldUntil = t + Math.round(seconds * TICKS_PER_SECOND);
      events.push({ t, type: 'shield', id: f.id, amount: f.shield, until: f.shieldUntil });
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
    hasBuff: (who, effect) => fighters[who.id].buffs.some((b) => b.effect === effect && t < b.until),
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
      basicAttack(f, target, t, false);
      // Only roll when there's a chance, so fights without it replay exactly as before.
      if (target.hp > 0 && f.hp > 0 && f.stats.hitAgain > 0 && nextFloat(rng) < f.stats.hitAgain) basicAttack(f, target, t, true);
    }
    f.nextAttack = t + attackInterval(f.stats);
  }

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
    const skill = UNIT_BY_ID[f.defId].skill;
    if (skill && target.hp > 0) SKILLS[skill].onBasicHit?.(api, f, target);
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

  for (const f of fighters) if (f.shield > 0) events.push({ t: 0, type: 'shield', id: f.id, amount: f.shield, until: f.shieldUntil });
  // The fight clock, in ticks. Declared before fight-start effects so skill passives can read it.
  let t = 0;
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

    // Shuffled each tick so neither side always strikes first.
    for (const f of shuffle(rng, fighters.filter((f) => f.hp > 0))) {
      if (f.hp <= 0 || t < f.stunnedUntil || t < f.busyUntil) continue;
      const enemies = fighters.filter((e) => e.side !== f.side && e.hp > 0);
      if (enemies.length === 0) break;

      // Stick with the current target while it's alive and in range.
      if (!f.target || f.target.hp <= 0 || dist(f, f.target) > f.stats.range) f.target = nearest(f, enemies);
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
  const survivors = winner === null ? [] : fighters.filter((f) => f.side === winner && f.hp > 0).map(snapshot);
  return { fighters: start, traits, events, ticks: t, winner, survivors };
}
