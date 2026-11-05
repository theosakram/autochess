import { MANA_PER_ATTACK, MANA_PER_HIT_TAKEN, MAX_COMBAT_TICKS, MOVE_TICKS, TICKS_PER_SECOND } from './config';
import { boardToGrid, dist, GRID_H, GRID_W, gridIndex, safestCell, stepToward, type Side } from './grid';
import { nextFloat, shuffle } from './rng';
import { applyMods, type DamageType, type Stats } from './stats';
import { activeTraits, chosenBy, traitPulses, traitTiles, unitStats, unitTriggers, type TraitLevels, type Trigger } from './traits';
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
    }
  // Damage from a trait itself (a pulse), not from a unit.
  | { t: number; type: 'effect'; trait: string; target: number; damage: number; hp: number }
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
  triggers: { trait: string; trigger: Trigger; fired: boolean }[];
  nextAttack: number;
  nextMove: number;
  target: SimFighter | null;
}

export function enemyDeaths(result: CombatResult, side: Side): number {
  const enemies = new Set(result.fighters.filter((f) => f.side !== side).map((f) => f.id));
  return result.events.filter((e) => e.type === 'death' && enemies.has(e.id)).length;
}

// Armor vs physical, mr vs magic. Negative defense amplifies damage, mirroring how positive reduces it.
export function defenseMult(defense: number): number {
  return defense >= 0 ? 100 / (100 + defense) : 2 - 100 / (100 - defense);
}

function deploy(p: Player, side: Side, levels: TraitLevels, scale: number, chosen: Record<string, string>, out: SimFighter[]): void {
  const tiles = traitTiles(levels);
  p.board.forEach((u, cell) => {
    if (!u) return;
    const def = UNIT_BY_ID[u.defId];
    const stats = unitStats(def, u.star, { levels, cell, scale, chosen, stacks: p.stacks });
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
      stats,
      shred: 0,
      triggers: unitTriggers(levels, def).map((tr) => ({ ...tr, fired: false })),
      nextAttack: Math.floor(stats.attackTicks / 2),
      nextMove: 0,
      target: null,
    });
  });
}

const snapshot = ({ id, side, defId, star, x, y, hp, maxHp, mana, maxMana, onTile, chosen }: Fighter): Fighter => ({
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
    useTraits[0] ? activeTraits(home.board) : {},
    useTraits[1] ? activeTraits(away.board) : {},
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
  const gainMana = (f: SimFighter, n: number) => (f.mana = Math.min(f.maxMana, f.mana + n));

  // The one place hp goes down. `amp` is the attacker's damageAmp (0 for trait damage).
  function damage(target: SimFighter, raw: number, type: DamageType, amp: number): number {
    const defense = (type === 'physical' ? target.stats.armor : target.stats.mr) - target.shred;
    const dealt = Math.round(raw * (1 + amp) * defenseMult(defense));
    target.hp = Math.max(0, target.hp - dealt);
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

  function strike(f: SimFighter, target: SimFighter, t: number): void {
    const cast = f.mana >= f.maxMana;
    let dealt: number;
    let crit = false;
    if (cast) {
      dealt = damage(target, f.stats.atk * f.stats.castMult, 'magic', f.stats.damageAmp);
      f.mana = 0;
    } else {
      // Shred lands before the damage, so the first hit already benefits.
      target.shred = Math.max(target.shred, f.stats.armorShred);
      // Only roll when there's a chance, so crit-free fights replay exactly as before crits existed.
      crit = f.stats.critChance > 0 && nextFloat(rng) < f.stats.critChance;
      dealt = damage(target, f.stats.atk * (crit ? f.stats.critDamage : 1), 'physical', f.stats.damageAmp);
      gainMana(f, MANA_PER_ATTACK);
    }
    gainMana(target, MANA_PER_HIT_TAKEN);
    events.push({
      t,
      type: cast ? 'cast' : 'attack',
      id: f.id,
      target: target.id,
      damage: dealt,
      hp: target.hp,
      mana: Math.floor(f.mana),
      targetMana: Math.floor(target.mana),
      ...(crit && { crit: true }),
    });
    f.nextAttack = t + f.stats.attackTicks;
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
        const dealt = damage(target, target.maxHp * pulse.pctMaxHp, pulse.damageType, 0);
        events.push({ t, type: 'effect', trait, target: target.id, damage: dealt, hp: target.hp });
        afterDamage(target, t);
      }
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

  let t = 0;
  for (; t < MAX_COMBAT_TICKS && alive(0) && alive(1); t++) {
    for (const f of fighters) if (f.hp > 0) gainMana(f, f.stats.manaRegen / TICKS_PER_SECOND);
    firePulses(t);

    // Shuffled each tick so neither side always strikes first.
    for (const f of shuffle(rng, fighters.filter((f) => f.hp > 0))) {
      if (f.hp <= 0) continue;
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
