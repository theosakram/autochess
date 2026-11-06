import { beastOf, BEAST_PIECE, markedUid, powersOf, protectedUids, type BeastPower, type WardPower } from './commanders';
import { BOARD_COLS, MANA_PER_ATTACK, MANA_PER_HIT_TAKEN, MAX_COMBAT_TICKS, MOVE_TICKS, TICKS_PER_SECOND } from './config';
import { boardToGrid, dist, GRID_H, GRID_W, gridIndex, safestCell, stepToward, type Side, type Point } from './grid';
import { activeItems, fieldStats, heldBy, leadsOf } from './inventory';
import { EQUIPMENT, ITEMS, type HealingSpring, type LowHpFury, type StackingPassive } from './items';
import { nextFloat, nextInt, shuffle } from './rng';
import { SKILLS, type SkillApi } from './skills';
import { applyMods, attackInterval, BURN_SECONDS, type DamageType, type Stats, type StatKey, baseStats } from './stats';
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
  | { t: number; type: 'stun'; id: number; by: number; until: number; effect?: string } // effect: how it looks (e.g. 'sheep')
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
  | { t: number; type: 'death'; id: number }
  // A commander piece (the Divine Beast) shows up where it stands on `side`'s board, fires, and is gone.
  | { t: number; type: 'piece'; defId: string; side: Side; x: number; y: number };

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
  ward: WardPower | null; // Kagura's umbrella, until it opens (see checkWard)
  refund: number; // Angela's protection: share of max mana regained after each cast
  castMana: number; // flat mana regained after each cast (Purple Buff)
  sheep: { opening: number; onHit: number; cooldown: number } | null; // Sheep Stick
  sheepReady: number; // tick its next on-hit sheep is ready
  ccImmuneUntil: number; // no stuns, taunts or enemy displacement before this tick (Purify)
  spring: HealingSpring | null; // Revitalize, until it's used up (see checkSpring)
  fury: LowHpFury | null; // Blade of Despair: more damage when hitting low-hp targets
  engulf: number; // Demon Hunter Sword: basic attacks add this share of the target's max hp
  lifebane: { cut: number; seconds: number } | null; // Sea Halberd: its damage cuts the target's healing
  antiHeal: { cut: number; until: number }; // healing it receives is cut by this, until then
  hexes: { effect: string; mods: { stat: StatKey; add: number }[]; seconds: number }[]; // its skill damage puts these on targets
  scorch: { effect: string; share: number; min: number; seconds: number; cut: number } | null; // Glowing Wand
  freeze: { below: number; seconds: number; heal: number } | null; // Winter Crown, until it's used
  frozen: { until: number; healPerTick: number }; // frozen now: no acting, no damage, untargetable
  // Item passives that stack as it deals damage (see ItemDef.stacking), one per effect.
  stacking: { def: StackingPassive; n: number; until: number }[];
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

// Items like the Thief Tool copy random equipment for one fight: a copy of the player whose holders also
// hold those (different, random, never the copier itself). The player's own items stay untouched.
function withCopies(rng: { rng: number }, p: Player): Player {
  const extra: Player['items'] = [];
  for (const it of p.items) {
    const n = it.holder === null ? 0 : (ITEMS[it.id].copies ?? 0);
    if (!n || !p.board.some((u) => u?.uid === it.holder)) continue;
    const pool = EQUIPMENT.filter((id) => !ITEMS[id].copies);
    for (let k = 0; k < n && pool.length; k++) {
      const [id] = pool.splice(nextInt(rng, pool.length), 1);
      extra.push({ uid: -1 - extra.length - it.uid * 10, id, tier: 1, holder: it.holder });
    }
  }
  return extra.length ? { ...p, items: [...p.items, ...extra] } : p;
}

function deploy(p: Player, side: Side, levels: TraitLevels, scale: number, chosen: Record<string, string>, out: SimFighter[]): void {
  const tiles = traitTiles(levels);
  const allStats = fieldStats(p, levels, chosen, scale);
  p.board.forEach((u, cell) => {
    // Commander pieces never fight (see fireBeasts).
    if (!u || UNIT_BY_ID[u.defId].piece) return;
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
      // Spellblade Talisman: a head start on mana.
      mana: Math.min(stats.maxMana, stats.maxMana * Math.max(0, ...items.map(({ id }) => ITEMS[id].startMana ?? 0))),
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
      spring: items.map(({ id }) => ITEMS[id].spring).find((s) => s) ?? null,
      fury: items.map(({ id }) => ITEMS[id].lowHpFury).find((s) => s) ?? null,
      engulf: Math.max(0, ...items.map(({ id }) => ITEMS[id].engulf ?? 0)),
      lifebane: items.map(({ id }) => ITEMS[id].lifebane).find((s) => s) ?? null,
      antiHeal: { cut: 0, until: 0 },
      scorch: items.map(({ id }) => ITEMS[id].scorch).find((s) => s) ?? null,
      freeze: items.map(({ id }) => ITEMS[id].freeze).find((s) => s) ?? null,
      frozen: { until: 0, healPerTick: 0 },
      hexes: [...new Map(items.flatMap(({ id }) => (ITEMS[id].skillHex ? [[ITEMS[id].skillHex!.effect, ITEMS[id].skillHex!] as const] : []))).values()],
      ccImmuneUntil: Math.round(Math.max(0, ...items.map(({ id }) => ITEMS[id].ccImmune ?? 0)) * TICKS_PER_SECOND),
      stacking: [...new Map(items.flatMap(({ id }) => (ITEMS[id].stacking ? [[ITEMS[id].stacking!.effect, ITEMS[id].stacking!] as const] : []))).values()].map(
        (def) => ({ def, n: 0, until: 0 }),
      ),
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
      ward: u.uid === markedUid(p, 'ward') ? (powersOf(p).ward ?? null) : null,
      refund: protectedUids(p).has(u.uid) ? (powersOf(p).protect?.refund ?? 0) : 0,
      castMana: Math.max(0, ...items.map(({ id }) => ITEMS[id].castMana ?? 0)),
      sheep: items.map(({ id }) => ITEMS[id].sheep).find((s) => s) ?? null,
      sheepReady: 0,
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
  deploy(withCopies(rng, home), 0, traits[0], scale[0], chosen, fighters);
  deploy(withCopies(rng, away), 1, traits[1], scale[1], chosen, fighters);
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
    if (t < target.frozen.until) return 0;
    // Blade of Despair: a low target fuels the dealer before this hit is worked out.
    if (dealer?.fury && target.hp < target.maxHp * dealer.fury.below) {
      api.buff(dealer, [{ stat: 'damageAmp', add: dealer.fury.amp }], dealer.fury.seconds, dealer.fury.effect, dealer);
    }
    const amp = dealer ? dealer.stats.damageAmp : 0;
    const stat = type === 'physical' ? 'armor' : 'mr';
    const lowered = target.debuffs.reduce((n, d) => n + (t < d.until ? d[stat] : 0), 0);
    const raw0 = type === 'pure' ? 0 : target.stats[stat] - target.shred - lowered;
    // Magic penetration ignores a share of what magic resist is left.
    const defense = type === 'magic' && dealer && raw0 > 0 ? raw0 * (1 - Math.min(1, dealer.stats.magicPen)) : raw0;
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
    // Winter Crown: a lethal hit freezes it at 1 hp instead.
    const lethal = target.freeze !== null && dealt - absorbed >= target.hp;
    target.hp = lethal ? 1 : Math.max(0, target.hp - (dealt - absorbed));
    if (lethal) freezeNow(target);
    if (dealer) dealer.dealt += dealt;
    if (dealer && dealt > 0) stackUp(dealer, 'damage');
    if (dealer?.lifebane && dealt > 0) {
      const active = t < target.antiHeal.until;
      target.antiHeal = { cut: Math.max(active ? target.antiHeal.cut : 0, dealer.lifebane.cut), until: t + Math.round(dealer.lifebane.seconds * TICKS_PER_SECOND) };
      if (!active) events.push({ t, type: 'debuff', id: target.id, by: dealer.id, effect: 'lifebane', armor: 0, mr: 0, until: target.antiHeal.until });
    }
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
    if (target.hp > 0) checkWard(target, t);
    if (target.hp > 0) checkSpring(target, t);
    if (target.hp > 0 && target.freeze && target.hp < target.maxHp * target.freeze.below) freezeNow(target);
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
      const heal = Math.min(target.maxHp - target.hp, Math.round(target.maxHp * tr.trigger.healPct * healMult(target)));
      target.hp += heal;
      target.stats = applyMods(target.stats, tr.trigger.mods);
      events.push({ t, type: 'trigger', trait: tr.trait, id: target.id, x: target.x, y: target.y, hp: target.hp, heal });
    }
  }

  // Heals the dealer for a share of what it dealt: lifesteal on basic attacks, spell lifesteal on the rest.
  // Healing it receives right now, after Lifebane-style cuts.
  const healMult = (f: SimFighter) => (t < f.antiHeal.until ? 1 - f.antiHeal.cut : 1);

  function leech(f: SimFighter, dealt: number, basicAttack: boolean, t: number): void {
    const rate = basicAttack ? f.stats.lifesteal : f.stats.spellLifesteal;
    if (rate <= 0 || f.hp <= 0) return;
    const amount = Math.min(f.maxHp - f.hp, Math.round(dealt * rate * healMult(f)));
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
    if (basic) {
      engulf(s, victim);
      ignite(s, victim);
    } else hex(s, victim);
    if (basic && dealt > 0) sheepOnHit(s, victim);
    return victim.hp <= 0;
  }

  // Item hexes (e.g. Ice Queen Wand's Ice Bound): skill damage puts them on the target, refreshed per hit.
  function hex(f: SimFighter, target: SimFighter): void {
    if (target.hp <= 0) return;
    for (const h of f.hexes) api.buff(target, h.mods, h.seconds, h.effect, f);
    if (f.scorch) scorch(f, f.scorch, target);
  }

  // Glowing Wand's Scorch: one burn per target and source, refreshed by every skill hit; it also cuts healing.
  const burns: { source: SimFighter; target: SimFighter; effect: string; perSecond: number; next: number; until: number }[] = [];
  function scorch(f: SimFighter, s: NonNullable<SimFighter['scorch']>, target: SimFighter): void {
    const until = t + Math.round(s.seconds * TICKS_PER_SECOND);
    const perSecond = Math.max(s.min, target.maxHp * s.share);
    const live = burns.find((b) => b.source === f && b.target === target && b.effect === s.effect && t < b.until);
    if (live) live.until = until;
    else burns.push({ source: f, target, effect: s.effect, perSecond, next: t + TICKS_PER_SECOND, until });
    const active = t < target.antiHeal.until;
    target.antiHeal = { cut: Math.max(active ? target.antiHeal.cut : 0, s.cut), until: Math.max(active ? target.antiHeal.until : 0, until) };
  }
  // Basic-attack burns (Stats.burnOnHit, e.g. Cult of Fire): one per target and source, refreshed by every hit.
  function ignite(f: SimFighter, target: SimFighter): void {
    if (f.stats.burnOnHit <= 0 || target.hp <= 0) return;
    const until = t + Math.round(BURN_SECONDS * TICKS_PER_SECOND);
    const live = burns.find((b) => b.source === f && b.target === target && b.effect === 'cultburn' && t < b.until);
    if (live) live.until = until;
    else burns.push({ source: f, target, effect: 'cultburn', perSecond: target.maxHp * f.stats.burnOnHit, next: t + TICKS_PER_SECOND, until });
  }

  function fireBurns(t: number): void {
    for (const b of burns) {
      if (t > b.until || t < b.next || b.target.hp <= 0) continue;
      const dealt = damage(b.target, b.perSecond, 'magic', b.source);
      events.push({ t, type: 'effect', effect: b.effect, by: b.source.id, target: b.target.id, damage: dealt, hp: b.target.hp });
      afterDamage(b.target, t);
      b.next = t + TICKS_PER_SECOND;
    }
    for (let i = burns.length - 1; i >= 0; i--) if (t >= burns[i].until || burns[i].target.hp <= 0) burns.splice(i, 1);
  }

  // Stuns and stun-likes (a sheep): no moving, attacking or casting. Purify blocks it. Returns whether it landed.
  function disable(f: SimFighter, seconds: number, by: SimFighter, effect?: string): boolean {
    const until = t + Math.round(seconds * TICKS_PER_SECOND);
    if (f.hp <= 0 || until <= f.stunnedUntil || t < f.ccImmuneUntil) return false;
    f.stunnedUntil = until;
    events.push({ t, type: 'stun', id: f.id, by: by.id, until, ...(effect && { effect }) });
    return true;
  }

  // Sheep Stick: a basic attack that dealt damage sheeps its target, off cooldown.
  function sheepOnHit(f: SimFighter, target: SimFighter): void {
    if (!f.sheep || t < f.sheepReady || target.hp <= 0) return;
    if (disable(target, f.sheep.onHit, f, 'sheep')) f.sheepReady = t + Math.round(f.sheep.cooldown * TICKS_PER_SECOND);
  }

  // Sheep Stick at the start: the enemy with the highest star (ties: higher cost, then first found).
  function fireSheep(): void {
    for (const f of fighters) {
      if (!f.sheep) continue;
      const foes = fighters.filter((e) => e.side !== f.side && e.hp > 0);
      const rank = (e: SimFighter) => e.star * 100 + UNIT_BY_ID[e.defId].tier;
      const best = foes.reduce<SimFighter | null>((b, e) => (!b || rank(e) > rank(b) ? e : b), null);
      if (best) disable(best, f.sheep.opening, f, 'sheep');
    }
  }

  // Demon Hunter Sword: a basic attack's extra bite, a share of the target's max hp.
  function engulf(f: SimFighter, target: SimFighter): void {
    if (!f.engulf || target.hp <= 0) return;
    const dealt = damage(target, target.maxHp * f.engulf, 'physical', f);
    events.push({ t, type: 'effect', effect: 'engulf', by: f.id, target: target.id, damage: dealt, hp: target.hp });
    afterDamage(target, t);
    leech(f, dealt, true, t);
  }

  // Item passives that build up with every damaging hit (e.g. War Axe's Fighting Spirit): one more
  // stack (up to max), all of them lasting from this hit; at max stacks the extra kicks in too.
  function stackUp(f: SimFighter, on: 'damage' | 'basic'): void {
    for (const s of f.stacking) {
      if ((s.def.on ?? 'damage') !== on) continue;
      if (t >= s.until) s.n = 0;
      const was = s.n;
      s.n = Math.min(s.def.max, s.n + 1);
      s.until = s.def.seconds === Infinity ? Infinity : t + Math.round(s.def.seconds * TICKS_PER_SECOND);
      const mods = [...s.def.perStack.flatMap((m) => ('add' in m ? [{ stat: m.stat, add: (m.add ?? 0) * s.n }] : [])), ...(s.n === s.def.max ? s.def.atMax : [])];
      // Same stack count: just keep it going; otherwise swap the buff for the bigger one.
      if (was === s.n && api.hasBuff(f, s.def.effect)) {
        const live = f.buffs.find((b) => b.effect === s.def.effect);
        if (live) live.until = s.until;
        continue;
      }
      api.buff(f, mods as { stat: StatKey; add: number }[], s.def.seconds, s.def.effect, f);
    }
  }

  // Winter Crown's Freeze: once per fight. Enemies going after it let go.
  function freezeNow(f: SimFighter): void {
    const s = f.freeze!;
    f.freeze = null;
    const ticks = Math.max(1, Math.round(s.seconds * TICKS_PER_SECOND));
    f.frozen = { until: t + ticks, healPerTick: (f.maxHp * s.heal) / ticks };
    for (const e of fighters) if (e.target === f) e.target = null;
    events.push({ t, type: 'buff', id: f.id, by: f.id, effect: 'freeze', until: f.frozen.until });
  }
  function fireFrozen(t: number): void {
    for (const f of fighters) if (f.hp > 0 && t < f.frozen.until) api.heal(f, f.frozen.healPerTick);
  }
  const frozen = (f: SimFighter) => t < f.frozen.until;

  // Revitalize: the first drop under the threshold leaves a healing spring on the holder's tile.
  const springs: { side: Side; cells: Point[]; heal: number; every: number; next: number; left: number; effect: string }[] = [];
  function checkSpring(f: SimFighter, t: number): void {
    if (!f.spring || f.hp >= f.maxHp * f.spring.below) return;
    const s = f.spring;
    f.spring = null;
    const cells = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: f.x + dx, y: f.y + dy }))).filter((c) => c.x >= 0 && c.y >= 0 && c.x < GRID_W && c.y < GRID_H);
    const every = Math.round(s.every * TICKS_PER_SECOND);
    springs.push({ side: f.side, cells, heal: s.heal, every, next: t, left: Math.round(s.seconds / s.every), effect: s.effect });
    events.push({ t, type: 'ground', effect: s.effect, cells, until: t + Math.round(s.seconds * TICKS_PER_SECOND) });
    fireSprings(t);
  }
  function fireSprings(t: number): void {
    for (const s of springs) {
      if (s.left <= 0 || t < s.next) continue;
      for (const c of s.cells) {
        const id = occupied[gridIndex(c)];
        const ally = id >= 0 ? fighters[id] : null;
        if (ally && ally.side === s.side && ally.hp > 0) api.heal(ally, ally.maxHp * s.heal);
      }
      s.left--;
      s.next = t + s.every;
    }
  }

  // Kagura's umbrella: the first time the marked hero drops below its threshold, a big shield opens
  // for the rest of the fight. Once per fight.
  function checkWard(f: SimFighter, t: number): void {
    if (!f.ward || f.hp >= f.maxHp * f.ward.below) return;
    f.shields.push({ effect: 'umbrella', amount: Math.round(f.maxHp * f.ward.shield), until: MAX_COMBAT_TICKS, onEnd: null });
    f.ward = null;
    events.push({ t, type: 'buff', id: f.id, by: f.id, effect: 'umbrella' });
    shieldEvent(f);
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
    enemiesOf: (f) => fighters.filter((e) => e.side !== f.side && e.hp > 0 && !frozen(e)),
    nearestEnemy: (f) => {
      const enemies = fighters.filter((e) => e.side !== f.side && e.hp > 0 && !frozen(e));
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
      // Displacement: an enemy's skill moving it. Immune units stay put.
      if (casting && casting.side !== f.side && t < f.ccImmuneUntil) return;
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
      if (t < f.ccImmuneUntil) return;
      f.taunt = { by: by.id, until };
      f.target = fighters[by.id];
      events.push({ t, type: 'taunt', id: f.id, by: by.id, until });
    },
    stun: (who, seconds, by) => {
      disable(fighters[who.id], seconds, fighters[by.id]);
    },
    heal: (who, amount) => {
      const f = fighters[who.id];
      const healed = Math.min(f.maxHp - f.hp, Math.round(amount * healMult(f)));
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
        ward: null,
        refund: 0,
        castMana: 0,
        sheep: null,
        sheepReady: 0,
        ccImmuneUntil: 0,
        spring: null,
        fury: null,
        engulf: 0,
        lifebane: null,
        antiHeal: { cut: 0, until: 0 },
        hexes: [],
        scorch: null,
        freeze: null,
        frozen: { until: 0, healPerTick: 0 },
        stacking: [],
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
      casting = r.f;
      r.fn();
      casting = null;
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
      hex(f, target);
    } else {
      fullBasicAttack(f, target, t);
    }
    // Mana straight back after a cast: Angela's protection (a share) and items like Purple Buff (flat).
    if (cast && (f.refund > 0 || f.castMana > 0)) f.mana = Math.min(f.maxMana, f.mana + f.maxMana * f.refund + f.castMana);
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
    stackUp(f, 'basic');
    hitEvent(f, target, t, 'attack', dealt, crit, again);
    leech(f, dealt, true, t);
    engulf(f, target);
    ignite(f, target);
    if (dealt > 0) sheepOnHit(f, target);
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
            if (!target || target.side === f.side || o.stunTicks <= target.stunnedUntil || target.ccImmuneUntil > 0) continue;
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

  // Items like Aegis: the holder and its left and right neighbours get a shield (see ItemDef.sideShield).
  // One per holder (unique); shields from different holders stack.
  function fireSideShields(): void {
    for (const f of fighters) {
      const held = new Map(f.items.flatMap(({ id }) => (ITEMS[id].sideShield ? [[ITEMS[id].sideShield!.effect, ITEMS[id].sideShield!] as const] : [])));
      for (const s of held.values()) {
        for (const ally of fighters) {
          if (ally.side !== f.side || ally.hp <= 0 || ally.y !== f.y || Math.abs(ally.x - f.x) > 1) continue;
          ally.shields.push({ effect: `${s.effect}${f.id}`, amount: Math.round(ally.maxHp * s.share), until: Math.round(s.seconds * TICKS_PER_SECOND), onEnd: null });
          shieldEvent(ally);
        }
      }
    }
  }

  // Commander beasts (see commanders/): each fires once from where it stands, then is gone.
  function fireBeasts(): void {
    [home, away].forEach((p, side) => {
      const power = beastOf(p);
      const cell = p.board.findIndex((u) => u?.defId === BEAST_PIECE);
      if (!power || cell < 0) return;
      const front = Math.floor(cell / BOARD_COLS) === 0 && power.frontRow;
      fireBeast(side as Side, boardToGrid(side as Side, cell), power, front);
    });
  }
  function fireBeast(side: Side, at: Point, power: BeastPower, front: boolean): void {
    const enemyAt = (p: Point) => {
      if (p.x < 0 || p.y < 0 || p.x >= GRID_W || p.y >= GRID_H) return null;
      const id = occupied[gridIndex(p)];
      return id >= 0 && fighters[id].side !== side && fighters[id].hp > 0 ? fighters[id] : null;
    };
    let cells: Point[];
    if (front) {
      // The 3 tiles right ahead of it.
      const y = at.y + (side === 0 ? -1 : 1);
      cells = [-1, 0, 1].map((dx) => ({ x: at.x + dx, y }));
    } else {
      // The 3x3 with the most enemies in it (ties: the first found).
      const square = (c: Point) => [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: c.x + dx, y: c.y + dy })));
      let best: { cells: Point[]; n: number } | null = null;
      for (let x = 0; x < GRID_W; x++) {
        for (let y = 0; y < GRID_H; y++) {
          const sq = square({ x, y });
          const n = sq.filter((c) => enemyAt(c)).length;
          if (n > 0 && (!best || n > best.n)) best = { cells: sq, n };
        }
      }
      if (!best) return;
      cells = best.cells;
    }
    cells = cells.filter((c) => c.x >= 0 && c.y >= 0 && c.x < GRID_W && c.y < GRID_H);
    const aim = front ? { x: at.x, y: cells[0]?.y ?? at.y } : cells[4] ?? cells[0];
    events.push({ t: 0, type: 'piece', defId: BEAST_PIECE, side, x: at.x, y: at.y });
    events.push({ t: 0, type: 'projectile', effect: BEAST_PIECE, from: at, to: aim, until: Math.round(0.3 * TICKS_PER_SECOND) });
    events.push({ t: 0, type: 'ground', effect: BEAST_PIECE, cells, until: Math.round(0.5 * TICKS_PER_SECOND) });
    for (const c of cells) {
      const target = enemyAt(c);
      if (!target) continue;
      const dealt = damage(target, target.maxHp * power.damage, 'magic', null);
      events.push({ t: 0, type: 'effect', effect: BEAST_PIECE, target: target.id, damage: dealt, hp: target.hp });
      afterDamage(target, 0);
      if (target.hp <= 0) continue;
      if (front) {
        const until = Math.round(power.shredSeconds * TICKS_PER_SECOND);
        const entry = { effect: BEAST_PIECE, armor: target.stats.armor * power.shred, mr: target.stats.mr * power.shred, until };
        target.debuffs.push(entry);
        events.push({ t: 0, type: 'debuff', id: target.id, by: -1, effect: BEAST_PIECE, armor: entry.armor, mr: entry.mr, until });
      } else {
        const until = Math.round(power.stun * TICKS_PER_SECOND);
        if (until <= target.stunnedUntil || target.ccImmuneUntil > 0) continue;
        target.stunnedUntil = until;
        events.push({ t: 0, type: 'stun', id: target.id, by: -1, until });
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

  // The fight clock, in ticks. Declared before fight-start effects so skill passives can read it.
  let t = 0;
  for (const f of fighters) if (f.shields.length) shieldEvent(f);
  if (alive(0) && alive(1)) {
    fireOpeners();
    fireSideShields();
    fireBeasts();
    fireSheep();
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
    fireSprings(t);
    fireBurns(t);
    fireFrozen(t);
    expireBuffs(t);
    expireShields(t);

    // Shuffled each tick so neither side always strikes first.
    for (const f of shuffle(rng, fighters.filter((f) => f.hp > 0))) {
      if (f.hp <= 0 || t < f.stunnedUntil || t < f.busyUntil || frozen(f)) continue;
      // Frozen enemies (Winter Crown) can't be targeted.
      const enemies = fighters.filter((e) => e.side !== f.side && e.hp > 0 && !frozen(e));
      if (enemies.length === 0) continue;

      // A taunted unit goes after its taunter; otherwise it sticks with its target while alive and in range.
      const taunter = f.taunt && t < f.taunt.until ? fighters[f.taunt.by] : null;
      if (taunter && taunter.hp > 0 && !frozen(taunter)) f.target = taunter;
      else if (!f.target || f.target.hp <= 0 || frozen(f.target) || dist(f, f.target) > f.stats.range) f.target = nearest(f, enemies);
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
