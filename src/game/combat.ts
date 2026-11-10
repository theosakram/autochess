import { beastOf, BEAST_PIECE, markedUid, powersOf, protectedUids, type BeastPower, type DuelPower, type IceArrowPower, type WardPower } from './commanders';
import { DISCO_FEVER, discoOf, DIVINE_EXECUTION, executeOf, sharpArmoryOf } from './powerCards';
import { AFTERSHOCK, BLAZING_VALOR, CRITICAL_SPELLCRAFT, CUTTHROAT, HAIL_OF_SHOTS, KO_PUNCH, PERKS, perksOf, STAR_CHORUS, WHIRL_OF_CARNAGE, antiHealOf, ASTRAL_JUDGEMENT, attackManaOf, CRUSHING_CLAW, crushingClawOf, judgementOf, DARK_BLADE_SECONDS, dragonShieldOf, fortifyOf, BERSERK_SECONDS, berserkOf, kamikazeOf, backManaOf, castRefundOf, sharpshooterOf } from './powerCards';
import { essenceTriggers } from './essence';
import { stageOf, BOARD_COLS, BOARD_ROWS, MANA_PER_ATTACK, MANA_PER_HIT_TAKEN, MAX_COMBAT_TICKS, MAX_ITEMS_PER_UNIT, MOVE_TICKS, OVERTIME, OVERTIME_TICKS, TICKS_PER_SECOND } from './config';
import { boardToGrid, dist, GRID_H, GRID_W, gridIndex, safestCell, stepToward, type Side, type Point } from './grid';
import { activeItems, fieldStats, heldBy, heroTraits, leadsOf, slotsUsed } from './inventory';
import { EQUIPMENT, ITEMS, type HealingSpring, type LowHpFury, type StackingPassive } from './items';
import { nextFloat, nextInt, shuffle } from './rng';
import { loveBeam, SKILLS, type SkillApi } from './skills';
import { adaptivePower, adaptiveType, applyMods, attackInterval, BURN_SECONDS, type DamageType, type Stats, type StatKey, baseStats } from './stats';
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
  items: { id: string; tier: number; uid?: number; count?: number }[]; // active items and the tier each works at (uid, count: items with a counter)
  orb: string | null; // trait its player's Magic Orb boosts through this unit type
  mistOrbs: string[]; // traits of the Mist orbs it holds
  copies?: number; // Alice's Blood Pact hero: copies piled in (its red stars)
  merc?: boolean; // Rogue Mercenary: shown with its marker
  signature?: boolean; // a hero card's hero: shown with its marker
}

// Mana values are after the event, rounded for display. Regen between events isn't logged.
const MANA_REPORT_TICKS = 3; // how often regen mana is sent to the view

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
  | { t: number; type: 'heal'; id: number; amount: number; hp: number; by?: number } // by: the healer, if not `id` itself
  // Mana from regen (Stargazer etc.), reported every MANA_REPORT_TICKS for units whose mana changed: [id, mana] pairs.
  | { t: number; type: 'mana'; mana: [number, number][] }
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
  | { t: number; type: 'dash'; id: number; x: number; y: number; seconds?: number; arc?: boolean }
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
  round?: number; // the game round, for effects that grow by stage (Angela's Love Beam)
}

interface SimFighter extends Fighter {
  stats: Stats;
  shred: number; // armor and mr currently removed by enemy attacks
  dealt: number; // damage dealt so far this fight (Storm Pursuit hunts the top dealer)
  owner: number | null; // summons: who summoned it
  mirror: number; // mirror summons: share of the owner's basic attack it repeats on the same target (0: acts on its own)
  debuffs: { effect: string; armor: number; mr: number; until: number }[]; // timed, from skills
  triggers: { trait: string; trigger: Trigger; fired: boolean }[];
  pulses: { item: string; every: number; atkPct: number; type: DamageType; area?: '3x3' }[]; // every in ticks
  openers: { source: string; width: number; depth: number; stunTicks: number; columnAttackSpeed: number }[];
  stunnedUntil: number;
  ward: WardPower | null; // Kagura's umbrella, until it opens (see checkWard)
  duelRing: DuelPower | null; // Lung: it started in the Dueling Ring
  duel: { with: number; until: number } | null; // in a duel with this enemy, until this tick (see fireDuels)
  refund: number; // Angela's protection: share of max mana regained after each cast
  loveBeam: { every: number; heal: number; damage: number } | null; // Angela's card: every `every` ticks
  castMana: number; // flat mana regained after each cast (Purple Buff)
  attackMana: number; // Magic Immersion: bonus mana on every basic attack
  chill: { effect: string; radius: number; attackSpeed: number; linger: number } | null; // Dominance Ice aura
  hurtMana: number; // Dominance Ice: extra share of mana from taking hits
  deter: { effect: string; perStack: number; max: number; seconds: number } | null; // Antique Cuirass
  deterStacks: { n: number; until: number }; // Deter stacks on this unit (as an attacker)
  regen: number; // Guardian Helmet: share of max hp healed every second
  sharpshooter: number; // Dimensional Shoot: share more damage per tile between it and its target
  // Trait perks from power cards (null: none). quakes: Aftershocks already set off; valor: Blazing Valor seconds
  // gained and what it's a share of; hail: Hail of Shots attack speed it has now.
  perks: {
    ko: boolean;
    quakes: number | null;
    valor: { seconds: number; hp: number; atk: number; ap: number } | null;
    whirl: boolean;
    hail: number | null;
    chorus: boolean;
    cutthroat: number | null; // the tick its next enhanced attack is ready
    spellCrit: boolean;
  };
  judgement: { readyAt: number; tick: number } | null; // Astral Judgement (an Astral Sovereign): next ready tick, and the tick it last fired
  fortify: number; // Fortified Defense: shield it gives itself and its left/right neighbours at the start
  dragonShield: number; // Valor's Embrace: share of a fallen ally's max hp it gets as a shield (Dragon Altar heroes)
  kamikaze: number; // Meltdown Armor: share of max hp blasted at the enemies around it when it dies
  berserk: { pct: number; atk: number; ap: number } | null; // Rising Fury: share of its starting atk/ap gained each second
  revive: number; // Ruby's Cloak: share of max hp it gets back up with, until used (0: none)
  rageMark: { effect: string; heal: number } | null; // Ruby's Cloak: its basic attacks mark their target
  marked: number | null; // the enemy its Rage Mark is on
  hunt: { effect: string; every: number; mult: number; fury: number } | null; // Ruby's Scythe
  iceArrow: IceArrowPower | null; // Miya's blessing: every few basic attacks, a volley
  arrows: number; // basic attacks toward the next volley
  killHeal: number; // Ice Longbow: a kill heals the lowest ally this share of its max hp
  killer: number | null; // the fighter whose hit first left it at 0 hp
  lastDealer: number | null; // the enemy that last damaged it (Divine Execution)
  huntNext: number; // tick its next Hunt strike is ready
  vengeance: number; // Blade Armor: share of any damage from an enemy sent back to it
  thunder: { effect: string; every: number; share: number; radius: number } | null; // Thunder Belt
  thunderReady: number; // tick its next charge is ready
  provoke: { effect: string; radius: number; seconds: number; perTargeter: number } | null; // Ancient Wrath
  provoked: number; // enemies targeting it, as its Provocation bonus last counted
  flurry: { chance: number; hits: number } | null; // Great Dragon Spear
  sheep: { opening: number; onHit: number; cooldown: number; vulnerable?: number } | null; // Sheep Stick
  sheepReady: number; // tick its next on-hit sheep is ready
  ccImmuneUntil: number; // no stuns, taunts or enemy displacement before this tick (Purify)
  spring: HealingSpring | null; // Revitalize, until it's used up (see checkSpring)
  fury: LowHpFury | null; // Blade of Despair: more damage when hitting low-hp targets
  engulf: number; // Demon Hunter Sword: basic attacks add this share of the target's max hp
  lifebane: { cut: number; seconds: number } | null; // Sea Halberd: its damage cuts the target's healing
  antiHeal: { cut: number; until: number }; // healing it receives is cut by this, until then
  hexes: { effect: string; mods: { stat: StatKey; add: number }[]; seconds: number }[]; // its skill damage puts these on targets
  scorch: { effect: string; share: number; min: number; seconds: number; cut: number } | null; // Glowing Wand
  freeze: { below: number; seconds: number; heal: number; mana?: number } | null; // Winter Crown, until it's used
  frozen: { until: number; healPerTick: number }; // frozen now: no acting, no damage, untargetable
  // Item passives that stack as it deals damage (see ItemDef.stacking), one per effect.
  stacking: { def: StackingPassive; n: number; until: number }[];
  taunt: { by: number; until: number } | null; // must go after this unit for now
  buffs: { effect: string; mods: { stat: StatKey; add: number }[]; until: number }[]; // timed, from skills
  busyUntil: number; // a skill is using it (e.g. a rampage): no attacking or walking before this tick
  rooted: boolean; // never walks (see SkillApi.stance)
  anchored: boolean; // can't be moved by anything (Turret)
  execute: number; // Divine Execution: its damage finishes enemies under this share of max hp
  gift: number; // Supreme Blade: executes adjacent enemies under this share of max hp (0 = none)
  plunder: number; // Plunderer's Claw: stun seconds of its opening hook (0 = none)
  noBasic: boolean; // never basic-attacks, only casts when its mana is full (see SkillApi.stance)
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

// Enemies killed by `killers` (fighter ids) or the summons they made: whoever dealt the first hit that
// left a target at 0 hp. Kills by trait effects, which have no dealer, count for nobody.
export function killsBy(result: CombatResult, killers: number[]): number {
  const ids = new Set(killers);
  const dead = new Set<number>();
  let kills = 0;
  for (const e of result.events) {
    if (e.type === 'summon' && ids.has(e.owner)) ids.add(e.fighter.id);
    if ((e.type !== 'attack' && e.type !== 'cast' && e.type !== 'effect') || e.hp > 0 || e.damage <= 0 || dead.has(e.target)) continue;
    dead.add(e.target);
    if (ids.has(e.type === 'effect' ? (e.by ?? -1) : e.id)) kills++;
  }
  return kills;
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
// hold those (random, one per group list for the holder's attack type, never the copier itself). The
// player's own items stay untouched.
function withCopies(rng: { rng: number }, p: Player): Player {
  const extra: Player['items'] = [];
  for (const it of p.items) {
    const rule = ITEMS[it.id].copies;
    const holder = it.holder === null ? undefined : p.board.find((u) => u?.uid === it.holder);
    if (!rule || !holder) continue;
    for (const groups of rule[UNIT_BY_ID[holder.defId].attackType ?? 'physical']) {
      const pool = EQUIPMENT.filter((id) => !ITEMS[id].copies && groups.includes(ITEMS[id].group!));
      if (!pool.length) continue;
      extra.push({ uid: -1 - extra.length - it.uid * 10, id: pool[nextInt(rng, pool.length)], tier: 1, holder: it.holder });
    }
  }
  return extra.length ? { ...p, items: [...p.items, ...extra] } : p;
}

function deploy(p: Player, side: Side, levels: TraitLevels, scale: number, chosen: Record<string, string>, out: SimFighter[], stage = 1): void {
  const beam = powersOf(p).loveBeam;
  const surge = attackManaOf(p);
  const rage = berserkOf(p);
  const blast = kamikazeOf(p);
  const sharp = sharpshooterOf(p);
  const darkBlade = antiHealOf(p);
  const fortify = fortifyOf(p);
  const perks = perksOf(p);
  const dragonShield = dragonShieldOf(p);
  const sovereign = backManaOf(p);
  const armory = sharpArmoryOf(p);
  const execute = executeOf(p);
  const blessing = castRefundOf(p);
  const beaming = beam ? protectedUids(p) : new Set<number>();
  const tiles = traitTiles(levels);
  const allStats = fieldStats(p, levels, chosen, scale);
  p.board.forEach((u, cell) => {
    // Commander pieces never fight (see fireBeasts).
    if (!u || UNIT_BY_ID[u.defId].piece) return;
    const def = UNIT_BY_ID[u.defId];
    const items = activeItems(heldBy(p, u.uid), levels);
    const stats = allStats.get(u.uid)!;
    const synergies = heroTraits(p, u, items);
    out.push({
      id: out.length,
      side,
      defId: u.defId,
      star: u.star,
      ...(u.copies !== undefined && { copies: u.copies }),
      ...(u.merc && { merc: true }),
      ...(u.signature && { signature: true }),
      ...boardToGrid(side, cell),
      hp: stats.hp,
      maxHp: stats.hp,
      // Spellblade Talisman: a head start on mana. Mana Sovereign: more for the back row.
      mana: Math.min(
        stats.maxMana,
        stats.maxMana * (Math.max(0, ...items.map(({ id }) => ITEMS[id].startMana ?? 0)) + (cell >= BOARD_COLS * (BOARD_ROWS - 1) ? sovereign : 0)),
      ),
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
      triggers: [...unitTriggers(levels, synergies), ...essenceTriggers(p, u.uid)].map((tr) => ({ ...tr, fired: false })),
      spring: items.map(({ id }) => ITEMS[id].spring).find((s) => s) ?? null,
      fury: items.map(({ id }) => ITEMS[id].lowHpFury).find((s) => s) ?? null,
      engulf: Math.max(0, ...items.map(({ id }) => ITEMS[id].engulf ?? 0)),
      // Sea Halberd's Lifebane and Dark Blade: the stronger cut, the longer time.
      lifebane: ((own) =>
        darkBlade ? { cut: Math.max(own?.cut ?? 0, darkBlade), seconds: Math.max(own?.seconds ?? 0, DARK_BLADE_SECONDS) } : own)(
        items.map(({ id }) => ITEMS[id].lifebane).find((s) => s) ?? null,
      ),
      antiHeal: { cut: 0, until: 0 },
      scorch: items.map(({ id }) => ITEMS[id].scorch).find((s) => s) ?? null,
      freeze: items.flatMap(({ id }) => (ITEMS[id].freeze ? [ITEMS[id].freeze!] : [])).sort((x, y) => y.heal - x.heal)[0] ?? null, // enhanced wins
      frozen: { until: 0, healPerTick: 0 },
      hexes: [...new Map(items.flatMap(({ id }) => (ITEMS[id].skillHex ? [[ITEMS[id].skillHex!.effect, ITEMS[id].skillHex!] as const] : []))).values()],
      ccImmuneUntil: Math.round(Math.max(0, ...items.map(({ id }) => ITEMS[id].ccImmune ?? 0)) * TICKS_PER_SECOND),
      stacking: [
        ...[...new Map(items.flatMap(({ id }) => (ITEMS[id].stacking ? [[ITEMS[id].stacking!.effect, ITEMS[id].stacking!] as const] : []))).values()],
        // Sharp Armory: back-row heroes build attack and magic attack with each basic attack, for the fight.
        ...(armory && cell >= BOARD_COLS * (BOARD_ROWS - 1)
          ? [{ effect: 'sharpArmory', on: 'basic' as const, perStack: [{ stat: 'atk' as const, add: stats.atk * armory.pct }, { stat: 'ap' as const, add: stats.ap * armory.pct }], atMax: [], max: armory.max, seconds: Infinity }]
          : []),
      ].map((def) => ({ def, n: 0, until: 0 })),
      // One per item id (the highest tier): a second copy doesn't fire again.
      pulses: [...new Map(items.map(({ id, tier }) => [id, tier] as const).sort((a, b) => a[1] - b[1])).entries()].flatMap(([id, tier]) => {
        const pulse = ITEMS[id].pulse?.(tier);
        return pulse ? [{ item: id, every: Math.round(pulse.every * TICKS_PER_SECOND), atkPct: pulse.atkPct, type: pulse.damageType, area: pulse.area }] : [];
      }),
      openers: [
        ...items.flatMap(({ id, tier }) => {
          const opener = ITEMS[id].opener?.(tier);
          return opener ? [{ source: id, opener }] : [];
        }),
        ...unitOpeners(levels, synergies),
      ].map(({ source, opener: o }) => ({
        source,
        width: o.width,
        depth: o.depth,
        stunTicks: Math.round(o.stunSeconds * TICKS_PER_SECOND),
        columnAttackSpeed: o.columnAttackSpeed ?? 0,
      })),
      stunnedUntil: 0,
      ward: u.uid === markedUid(p, 'ward') ? (powersOf(p).ward ?? null) : null,
      duelRing: powersOf(p).duel?.cell === cell ? powersOf(p).duel! : null,
      duel: null,
      refund: (protectedUids(p).has(u.uid) ? (powersOf(p).protect?.refund ?? 0) : 0) + blessing,
      loveBeam:
        beam && beaming.has(u.uid)
          ? { every: Math.round(beam.every * TICKS_PER_SECOND), heal: beam.heal, damage: beam.damage[Math.min(stage, beam.damage.length) - 1] }
          : null,
      castMana: Math.max(0, ...items.map(({ id }) => ITEMS[id].castMana ?? 0)),
      attackMana: heldBy(p, u.uid).length ? surge : 0,
      chill: items.map(({ id }) => ITEMS[id].chill).find((s) => s) ?? null,
      hurtMana: Math.max(0, ...items.map(({ id }) => ITEMS[id].hurtMana ?? 0)),
      deter: items.map(({ id }) => ITEMS[id].deter).find((s) => s) ?? null,
      deterStacks: { n: 0, until: 0 },
      regen: Math.max(0, ...items.map(({ id }) => ITEMS[id].regen ?? 0)),
      berserk: rage ? { pct: rage, atk: stats.atk, ap: stats.ap } : null,
      kamikaze: blast,
      perks: ((mine: Set<string>) => {
        const has = (k: keyof typeof PERKS) => perks.has(k) && mine.has(PERKS[k]);
        return {
          ko: has('koPunch'),
          quakes: has('aftershock') ? 0 : null,
          valor: has('blazingValor') ? { seconds: 0, hp: stats.hp, atk: stats.atk, ap: stats.ap } : null,
          whirl: has('whirlOfCarnage'),
          hail: has('hailOfShots') ? 0 : null,
          chorus: has('starChorus'),
          cutthroat: has('cutthroat') ? Math.round(CUTTHROAT.every * TICKS_PER_SECOND) : null,
          spellCrit: has('criticalSpellcraft'),
        };
      })(synergies),
      judgement: judgementOf(p) && leadsOf(p, levels, u.uid).includes('astral') ? { readyAt: 0, tick: -1 } : null,
      fortify: fortify && slotsUsed(p, u.uid) >= MAX_ITEMS_PER_UNIT ? fortify : 0,
      dragonShield: dragonShield && synergies.has('dragonaltar') ? dragonShield : 0, // orbs count too
      sharpshooter: sharp,
      revive: Math.max(0, ...items.map(({ id }) => ITEMS[id].revive ?? 0)),
      rageMark: items.map(({ id }) => ITEMS[id].rageMark).find((s) => s) ?? null,
      marked: null,
      hunt: items.map(({ id }) => ITEMS[id].hunt).find((s) => s) ?? null,
      iceArrow: u.uid === markedUid(p, 'iceArrow') ? (powersOf(p).iceArrow ?? null) : null,
      arrows: 0,
      killHeal: Math.max(0, ...items.map(({ id }) => ITEMS[id].killHeal ?? 0)),
      killer: null,
      lastDealer: null,
      huntNext: Math.round((items.map(({ id }) => ITEMS[id].hunt).find((s) => s)?.every ?? 0) * TICKS_PER_SECOND),
      vengeance: Math.max(0, ...items.map(({ id }) => ITEMS[id].vengeance ?? 0)),
      thunder: items.map(({ id }) => ITEMS[id].thunder).find((s) => s) ?? null,
      thunderReady: 0,
      provoke: items.flatMap(({ id }) => (ITEMS[id].provoke ? [ITEMS[id].provoke!] : [])).sort((x, y) => y.perTargeter - x.perTargeter)[0] ?? null, // enhanced wins
      provoked: 0,
      flurry: items.map(({ id }) => ITEMS[id].flurry).find((s) => s) ?? null,
      sheep: items.flatMap(({ id }) => (ITEMS[id].sheep ? [ITEMS[id].sheep!] : [])).sort((x, y) => (y.vulnerable ?? 0) - (x.vulnerable ?? 0))[0] ?? null, // enhanced wins
      sheepReady: 0,
      taunt: null,
      buffs: [],
      busyUntil: 0,
      rooted: !!def.rooted,
      anchored: !!def.rooted,
      execute,
      gift: Math.max(0, ...items.map(({ id }) => ITEMS[id].gift?.below ?? 0)),
      plunder: Math.max(0, ...items.map(({ id }) => ITEMS[id].plunder?.stun ?? 0)),
      noBasic: false,
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

const snapshot = ({ id, side, defId, star, x, y, hp, maxHp, mana, maxMana, onTile, chosen, leads, items, orb, mistOrbs, copies }: Fighter): Fighter => ({
  ...(copies !== undefined && { copies }),
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
  const stage = stageOf(opts.round ?? 1);
  deploy(withCopies(rng, home), 0, traits[0], scale[0], chosen, fighters, stage);
  deploy(withCopies(rng, away), 1, traits[1], scale[1], chosen, fighters, stage);
  const disco = [discoOf(home), discoOf(away)]; // Disco Fever, per side
  // Enhanced Oracle: its row starts with more max hp, before the snapshot so the replay's bars show it.
  // Once per hero, however many enhanced Oracles share the row.
  for (const ally of fighters) {
    const pct = Math.max(0, ...fighters.filter((f) => f.side === ally.side && f.y === ally.y).flatMap((f) => f.items.map(({ id }) => ITEMS[id].rowBuff?.hpPct ?? 0)));
    if (!pct) continue;
    const hp = Math.round(ally.maxHp * pct);
    ally.maxHp += hp;
    ally.hp += hp;
  }
  const start = fighters.map(snapshot);

  const occupied = new Int16Array(GRID_W * GRID_H).fill(-1);
  for (const f of fighters) occupied[gridIndex(f)] = f.id;

  const events: CombatEvent[] = [];
  const alive = (side: Side) => fighters.some((f) => f.side === side && f.hp > 0);
  // No mana while a skill keeps the unit busy, so a long skill can't chain straight into the next.
  const gainMana = (f: SimFighter, n: number) => {
    if (t < f.busyUntil || dueling(f)) return;
    f.mana = Math.min(f.maxMana, f.mana + n);
  };

  // The one place hp goes down. `dealer` is the unit dealing it (credited for it), or null for trait damage.
  function damage(target: SimFighter, raw: number, given: DamageType, dealer: SimFighter | null): number {
    // Adaptive: physical or magic by the dealer's higher stat, right now (physical without a dealer).
    const type = given === 'adaptive' ? (dealer ? adaptiveType(dealer.stats) : 'physical') : given;
    if (t < target.frozen.until) return 0;
    // Lung's duel: the duelists only hurt, and are only hurt by, each other.
    if (cutOff(dealer, target)) return 0;
    // Blade of Despair: a low target fuels the dealer before this hit is worked out.
    if (dealer?.fury && target.hp < target.maxHp * dealer.fury.below) {
      api.buff(dealer, [{ stat: 'damageAmp', add: dealer.fury.amp }], dealer.fury.seconds, dealer.fury.effect, dealer);
    }
    const amp = dealer ? dealer.stats.damageAmp : 0;
    const stat = type === 'physical' ? 'armor' : 'mr';
    const lowered = target.debuffs.reduce((n, d) => n + (t < d.until ? d[stat] : 0), 0);
    const raw0 = type === 'pure' ? 0 : target.stats[stat] - target.shred - lowered;
    // Penetration ignores a share of what defense is left: magic pen of magic resist, armor pen of armor.
    const pen = !dealer || raw0 <= 0 ? 0 : type === 'magic' ? dealer.stats.magicPen : type === 'physical' ? dealer.stats.armorPen : 0;
    const defense = raw0 * (1 - Math.min(1, pen));
    const guard = t < target.guardUntil ? 1 - target.guardReduction : 1;
    // Dimensional Shoot: tiles between dealer and target (none when next to each other).
    const range = dealer?.sharpshooter ? 1 + dealer.sharpshooter * Math.max(0, dist(dealer, target) - 1) : 1;
    const dealt = Math.round(raw * (1 + amp) * (1 + target.stats.damageTaken) * defenseMult(defense) * guard * range);
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
    if (dealer && dealer.side !== target.side) target.lastDealer = dealer.id;
    // Blade Armor: queued, sent back once this hit is done (a reflection never reflects again).
    if (target.vengeance && dealer && dealer.side !== target.side && dealt > 0 && !reflecting) pendingVengeance.push({ holder: target, attacker: dealer, taken: dealt });
    if (target.hp <= 0 && dealer && target.killer === null) target.killer = dealer.id;
    if (lethal) freezeNow(target);
    if (dealer) dealer.dealt += dealt;
    if (dealer && dealt > 0) stackUp(dealer, 'damage');
    if (dealer && dealt > 0 && target.deter && dealer.side !== target.side && dealer.hp > 0) deterHit(target, dealer);
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
    flushVengeance(t);
  }

  function reactToDamage(target: SimFighter, t: number): void {
    aftershock(target, t);
    if (target.hp <= 0 && target.revive > 0) getUp(target, t);
    if (target.hp > 0) checkExecute(target, t);
    if (target.hp > 0) checkWard(target, t);
    if (target.hp > 0) checkSpring(target, t);
    if (target.hp > 0 && target.freeze && target.hp < target.maxHp * target.freeze.below) freezeNow(target);
    if (target.hp <= 0) {
      occupied[gridIndex(target)] = -1;
      events.push({ t, type: 'death', id: target.id });
      // Ice Longbow: its wearer's kill heals the lowest ally.
      const killer = fighters.find((f) => f.id === target.killer);
      if (killer && killer.hp > 0 && killer.killHeal > 0 && killer.side !== target.side) {
        const low = fighters
          .filter((f) => f.side === killer.side && f.hp > 0)
          .sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp || x.id - y.id)[0];
        if (low) {
          events.push({ t, type: 'effect', effect: 'frostmercy', by: killer.id, target: low.id, damage: 0, hp: low.hp });
          api.heal(low, low.maxHp * killer.killHeal, killer);
        }
      }
      // Ruby's Cloak: its marked enemy fell.
      for (const f of fighters) {
        if (f.marked !== target.id) continue;
        f.marked = null;
        if (f.hp > 0 && f.rageMark) api.heal(f, f.maxHp * f.rageMark.heal);
      }
      kamikazeBlast(target, t);
      // Valor's Embrace: a fallen hero (not a summon) shields its side's Dragon Altar heroes.
      if (target.owner === null) {
        for (const f of fighters) {
          if (f.side !== target.side || f.hp <= 0 || !f.dragonShield) continue;
          f.shields.push({ effect: 'valorsEmbrace', amount: Math.round(target.maxHp * f.dragonShield), until: MAX_COMBAT_TICKS, onEnd: null });
          shieldEvent(f);
        }
      }
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
    // Critical Spellcraft: a Mage's skill damage may crit, for its own multiplier (rolled only for heroes with it).
    const spellCrit = !basic && s.perks.spellCrit && nextFloat(rng) < CRITICAL_SPELLCRAFT.chance;
    const critMult = crit ? s.stats.critDamage : spellCrit ? CRITICAL_SPELLCRAFT.mult : 1;
    crit ||= spellCrit;
    const dealt = damage(victim, raw * (1 + s.stats.skillAmp) * (basic ? 1 + s.stats.basicAmp : 1) * critMult, type, s);
    events.push({ t, type: 'effect', effect, by: s.id, target: victim.id, damage: dealt, hp: victim.hp, ...(crit && { crit: true }) });
    afterDamage(victim, t);
    leech(s, dealt, basic, t);
    if (basic) {
      engulf(s, victim);
      ignite(s, victim);
    } else hex(s, victim);
    if (basic && dealt > 0) sheepOnHit(s, victim);
    judgementBolt(s, victim);
    return victim.hp <= 0;
  }

  // Astral Judgement: a skill hit starts a Judgement (then ASTRAL_JUDGEMENT.cooldown); every enemy that skill
  // hits on that tick takes a bolt of pure damage.
  function judgementBolt(s: SimFighter, victim: SimFighter): void {
    const j = s.judgement;
    if (!j || victim.hp <= 0 || s.hp <= 0) return;
    if (t >= j.readyAt) {
      j.tick = t;
      j.readyAt = t + Math.round(ASTRAL_JUDGEMENT.cooldown * TICKS_PER_SECOND);
    }
    if (t !== j.tick) return;
    const dealt = damage(victim, Math.max(s.stats.atk, s.stats.ap) * ASTRAL_JUDGEMENT.atk, 'pure', s);
    events.push({ t, type: 'effect', effect: 'astralJudgement', by: s.id, target: victim.id, damage: dealt, hp: victim.hp });
    afterDamage(victim, t);
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
    if (cutOff(by, f)) return false; // a duelist: only its opponent
    const until = t + Math.round(seconds * TICKS_PER_SECOND);
    if (f.hp <= 0 || until <= f.stunnedUntil || t < f.ccImmuneUntil) return false;
    f.stunnedUntil = until;
    events.push({ t, type: 'stun', id: f.id, by: by.id, until, ...(effect && { effect }) });
    return true;
  }

  // Sheep Stick: a basic attack that dealt damage sheeps its target, off cooldown.
  function sheepOnHit(f: SimFighter, target: SimFighter): void {
    if (!f.sheep || t < f.sheepReady || target.hp <= 0) return;
    if (sheepify(target, f.sheep.onHit, f)) f.sheepReady = t + Math.round(f.sheep.cooldown * TICKS_PER_SECOND);
  }
  // A sheep; from an enhanced stick it also takes more damage for as long as it's one.
  function sheepify(target: SimFighter, seconds: number, by: SimFighter): boolean {
    if (!disable(target, seconds, by, 'sheep')) return false;
    // Weak while a sheep, like Eudora's Gale Shot: a timed damage-taken buff.
    if (by.sheep?.vulnerable) api.buff(target, [{ stat: 'damageTaken', add: by.sheep.vulnerable }], seconds, 'sheepweak', by);
    return true;
  }

  // Lung's Dueling Ring. When the fight starts, the hero in the ring drags the farthest enemy next to it and the
  // two duel: basic attacks only (no mana, so no skills), and nothing else can hurt or stun either of them, nor
  // they anyone else, until one falls or the time runs out. A win is logged ('duelWin') for the player's bonus.
  function dueling(f: SimFighter): boolean {
    return !!f.duel && t < f.duel.until && f.hp > 0 && fighters[f.duel.with].hp > 0;
  }
  function cutOff(by: SimFighter | null, target: SimFighter): boolean {
    if (dueling(target)) return by?.id !== target.duel!.with;
    return !!by && dueling(by);
  }
  function fireDuelStart(): void {
    for (const f of fighters) {
      const ring = f.duelRing;
      if (!ring || f.hp <= 0 || f.duel) continue;
      const foes = fighters.filter((e) => e.side !== f.side && e.hp > 0 && !e.duel);
      if (!foes.length) continue;
      const prey = foes.reduce((x, y) => (dist(f, y) > dist(f, x) || (dist(f, y) === dist(f, x) && y.id < x.id) ? y : x));
      // Dragged to a free tile next to the duelist (a Turret stays put).
      if (!prey.anchored && dist(f, prey) > 1) {
        const spots: Point[] = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const c = { x: f.x + dx, y: f.y + dy };
          if ((dx || dy) && c.x >= 0 && c.x < GRID_W && c.y >= 0 && c.y < GRID_H && occupied[gridIndex(c)] === -1) spots.push(c);
        }
        const to = spots.sort((a, b) => dist(a, prey) - dist(b, prey))[0];
        if (to) {
          occupied[gridIndex(prey)] = -1;
          prey.x = to.x;
          prey.y = to.y;
          occupied[gridIndex(prey)] = prey.id;
          events.push({ t, type: 'dash', id: prey.id, x: prey.x, y: prey.y });
        }
      }
      const until = t + Math.round(ring.seconds * TICKS_PER_SECOND);
      f.duel = { with: prey.id, until };
      prey.duel = { with: f.id, until };
      f.target = prey;
      prey.target = f;
      events.push({ t, type: 'effect', effect: 'duel', by: f.id, target: prey.id, damage: 0, hp: prey.hp });
    }
  }
  // Ends duels: a fallen opponent is a win for the ring's hero; at the time limit, nobody wins.
  function fireDuels(t: number): void {
    for (const f of fighters) {
      if (!f.duelRing || !f.duel) continue;
      const foe = fighters[f.duel.with];
      if (f.hp > 0 && foe.hp > 0 && t < f.duel.until) continue;
      if (f.hp > 0 && foe.hp <= 0) events.push({ t, type: 'effect', effect: 'duelWin', by: f.id, target: foe.id, damage: 0, hp: 0 });
      f.duel = null; // over (and fought only once a fight)
      foe.duel = null;
      if (f.target === foe && foe.hp > 0) f.target = null;
      if (foe.target === f && f.hp > 0) foe.target = null;
    }
  }

  // Sheep Stick at the start: the enemy with the highest star (ties: higher cost, then first found).
  function fireSheep(): void {
    for (const f of fighters) {
      if (!f.sheep) continue;
      const foes = fighters.filter((e) => e.side !== f.side && e.hp > 0);
      const rank = (e: SimFighter) => e.star * 100 + UNIT_BY_ID[e.defId].tier;
      const best = foes.reduce<SimFighter | null>((b, e) => (!b || rank(e) > rank(b) ? e : b), null);
      if (best) sheepify(best, f.sheep.opening, f);
    }
  }

  // Plunderer's Claw at the start: hooks the nearest enemy, stunning it. The gold (its cost) is paid after the
  // fight (see countPlunder in game.ts), from these 'plunder' events.
  function firePlunder(): void {
    for (const f of fighters) {
      if (!f.plunder) continue;
      const foes = fighters.filter((e) => e.side !== f.side && e.hp > 0);
      if (!foes.length) continue;
      const prey = nearest(f, foes);
      events.push({ t, type: 'effect', effect: 'plunder', by: f.id, target: prey.id, damage: 0, hp: prey.hp });
      disable(prey, f.plunder, f, 'plunder');
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

  // Thunder Belt: a charged basic attack also blasts its target and the enemies around it with a share of
  // the holder's max hp, magic. The next charge comes `every` seconds after.
  function thunderStrike(f: SimFighter, target: SimFighter): void {
    if (!f.thunder || t < f.thunderReady) return;
    const th = f.thunder;
    f.thunderReady = t + Math.round(th.every * TICKS_PER_SECOND);
    const hit = fighters.filter((e) => e.side !== f.side && e.hp > 0 && dist(e, target) <= th.radius);
    for (const e of hit) {
      const dealt = damage(e, f.maxHp * th.share, 'magic', f);
      events.push({ t, type: 'effect', effect: th.effect, by: f.id, target: e.id, damage: dealt, hp: e.hp });
      leech(f, dealt, false, t);
    }
    for (const e of hit) afterDamage(e, t);
  }

  // Meltdown Armor: a hero that dies blasts the enemies on the tiles around it with a share of its max hp, magic.
  // A kill can set off the next blast.
  function kamikazeBlast(f: SimFighter, t: number): void {
    if (!f.kamikaze) return;
    const hit = fighters.filter((e) => e.side !== f.side && e.hp > 0 && dist(e, f) <= 1);
    for (const e of hit) {
      const dealt = damage(e, f.maxHp * f.kamikaze, 'magic', f);
      events.push({ t, type: 'effect', effect: 'kamikaze', by: f.id, target: e.id, damage: dealt, hp: e.hp });
    }
    for (const e of hit) afterDamage(e, t);
  }

  // Aftershock: a Defender sets one off for every AFTERSHOCK.every of its max hp lost (the killing blow too).
  function aftershock(f: SimFighter, t: number): void {
    if (f.perks.quakes === null) return;
    const due = Math.min(Math.floor(1 / AFTERSHOCK.every), Math.floor((1 - Math.max(0, f.hp) / f.maxHp) / AFTERSHOCK.every + 1e-9));
    while (f.perks.quakes < due) {
      f.perks.quakes++;
      const hit = fighters.filter((e) => e.side !== f.side && e.hp > 0 && dist(e, f) <= 1);
      for (const e of hit) {
        const dealt = damage(e, f.maxHp * AFTERSHOCK.share, 'magic', f);
        events.push({ t, type: 'effect', effect: 'aftershock', by: f.id, target: e.id, damage: dealt, hp: e.hp });
      }
      for (const e of hit) afterDamage(e, t);
    }
  }

  // Whirl of Carnage and Star Chorus: what a cast sets off.
  function castPerks(f: SimFighter): void {
    if (f.hp <= 0) return;
    if (f.perks.whirl) {
      const hit = fighters.filter((e) => e.side !== f.side && e.hp > 0 && dist(e, f) <= 1);
      for (const e of hit) {
        const dealt = damage(e, f.stats.atk * WHIRL_OF_CARNAGE.atk, 'physical', f);
        events.push({ t, type: 'effect', effect: 'whirlOfCarnage', by: f.id, target: e.id, damage: dealt, hp: e.hp });
      }
      for (const e of hit) afterDamage(e, t);
    }
    if (f.perks.chorus) {
      const foes = fighters.filter((e) => e.side !== f.side && e.hp > 0);
      const hit = shuffle(rng, foes).slice(0, STAR_CHORUS.targets);
      for (const e of hit) {
        const dealt = damage(e, f.stats.ap * STAR_CHORUS.ap, 'magic', f);
        events.push({ t, type: 'effect', effect: 'starChorus', by: f.id, target: e.id, damage: dealt, hp: e.hp });
      }
      for (const e of hit) afterDamage(e, t);
    }
  }

  // Once a second: Blazing Valor grows while shielded (to its cap and bonus); Hail of Shots fades.
  // Disco Fever: every few seconds from the start, random enemies of a side holding it dance (can't act).
  function fireDisco(t: number): void {
    if (t % Math.round(DISCO_FEVER.every * TICKS_PER_SECOND) !== 0) return;
    for (const side of [0, 1] as const) {
      if (!disco[side]) continue;
      const dj = fighters.find((f) => f.side === side && f.hp > 0);
      if (!dj) continue;
      const floor = shuffle(rng, fighters.filter((f) => f.side !== side && f.hp > 0)).slice(0, DISCO_FEVER.dancers);
      for (const e of floor) disable(e, DISCO_FEVER.seconds, dj, 'disco');
    }
  }

  // Overtime: from OVERTIME_TICKS, every second, every living unit gets faster and hits harder (to end stalls).
  function fireOvertime(t: number): void {
    if (t < OVERTIME_TICKS || (t - OVERTIME_TICKS) % TICKS_PER_SECOND !== 0) return;
    for (const f of fighters) {
      if (f.hp <= 0) continue;
      f.stats = applyMods(f.stats, [{ stat: 'attackSpeed', add: OVERTIME.attackSpeed }, { stat: 'damageAmp', add: OVERTIME.damageAmp }]);
      if (t === OVERTIME_TICKS) events.push({ t, type: 'buff', id: f.id, by: f.id, effect: 'overtime' });
    }
  }

  function firePerks(t: number): void {
    if (t % TICKS_PER_SECOND !== 0) return;
    for (const f of fighters) {
      if (f.hp <= 0) continue;
      const v = f.perks.valor;
      if (v && t > 0 && v.seconds < BLAZING_VALOR.seconds && f.shields.some((l) => t < l.until && l.amount > 0)) {
        v.seconds++;
        const share = BLAZING_VALOR.perSecond + (v.seconds === BLAZING_VALOR.seconds ? BLAZING_VALOR.bonus : 0);
        const hp = Math.round(v.hp * share);
        f.maxHp += hp;
        f.hp += hp;
        f.stats = applyMods(f.stats, [{ stat: 'atk', add: v.atk * share }, { stat: 'ap', add: v.ap * share }]);
        events.push({ t, type: 'buff', id: f.id, by: f.id, effect: 'blazingValor', until: t + TICKS_PER_SECOND });
      }
      if (f.perks.hail !== null) {
        const now = HAIL_OF_SHOTS.speed * Math.max(0, 1 - t / (HAIL_OF_SHOTS.seconds * TICKS_PER_SECOND));
        if (now !== f.perks.hail) {
          f.stats = applyMods(f.stats, [{ stat: 'attackSpeed', add: now - f.perks.hail }]);
          f.perks.hail = now;
        }
      }
    }
  }

  // Miya's Ice Arrow Blessing: every `every`th basic attack, arrows at the nearest enemies (the target among
  // them), each a share of that enemy's max hp, physical.
  function iceVolley(f: SimFighter, target: SimFighter): void {
    const ice = f.iceArrow;
    if (!ice || ++f.arrows < ice.every) return;
    f.arrows = 0;
    const hit = fighters
      .filter((e) => e.side !== f.side && e.hp > 0 && t >= e.frozen.until)
      .sort((x, y) => (x === target ? -1 : y === target ? 1 : dist(f, x) - dist(f, y) || x.id - y.id))
      .slice(0, ice.targets);
    for (const e of hit) {
      events.push({ t, type: 'projectile', effect: 'icearrow', from: { x: f.x, y: f.y }, to: { x: e.x, y: e.y }, until: t + Math.round(0.3 * TICKS_PER_SECOND) });
      const dealt = damage(e, e.maxHp * ice.share, 'physical', f);
      events.push({ t, type: 'effect', effect: 'icearrow', by: f.id, target: e.id, damage: dealt, hp: e.hp });
      leech(f, dealt, false, t);
    }
    for (const e of hit) afterDamage(e, t);
  }

  // Blade Armor: any damage an enemy deals the holder sends a share of it back, physical. Queued by damage() and
  // sent once the hit is done; the reflected damage itself is never reflected (two Blade Armors don't ping-pong).
  const pendingVengeance: { holder: SimFighter; attacker: SimFighter; taken: number }[] = [];
  let reflecting = false;
  function flushVengeance(t: number): void {
    while (pendingVengeance.length && !reflecting) {
      const { holder, attacker, taken } = pendingVengeance.shift()!;
      if (attacker.hp <= 0) continue;
      reflecting = true;
      const dealt = damage(attacker, taken * holder.vengeance, 'physical', holder);
      reflecting = false;
      events.push({ t, type: 'effect', effect: 'vengeance', by: holder.id, target: attacker.id, damage: dealt, hp: attacker.hp });
      afterDamage(attacker, t);
    }
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

  // Antique Cuirass's Deter: hitting the holder costs the attacker a stack (up to max) of lower attack and
  // magic attack, all lasting from this hit. Each stack is a share of what it has without Deter.
  function deterHit(holder: SimFighter, attacker: SimFighter): void {
    const d = holder.deter!;
    const st = attacker.deterStacks;
    if (t >= st.until) st.n = 0;
    st.n = Math.min(d.max, st.n + 1);
    st.until = t + Math.round(d.seconds * TICKS_PER_SECOND);
    const live = attacker.buffs.find((b) => b.effect === d.effect);
    const without = (stat: StatKey) => attacker.stats[stat] - (live?.mods.find((m) => m.stat === stat)?.add ?? 0);
    const mods = (['atk', 'ap'] as const).map((stat) => ({ stat, add: -without(stat) * d.perStack * st.n }));
    api.buff(attacker, mods, d.seconds, d.effect, holder);
  }

  // Winter Crown's Freeze: once per fight. Enemies going after it let go.
  function freezeNow(f: SimFighter): void {
    const s = f.freeze!;
    f.freeze = null;
    const ticks = Math.max(1, Math.round(s.seconds * TICKS_PER_SECOND));
    f.frozen = { until: t + ticks, healPerTick: (f.maxHp * s.heal) / ticks };
    if (s.mana) gainMana(f, f.maxMana * s.mana); // enhanced Winter Crown
    for (const e of fighters) if (e.target === f) e.target = null;
    events.push({ t, type: 'buff', id: f.id, by: f.id, effect: 'freeze', until: f.frozen.until });
  }
  function fireFrozen(t: number): void {
    for (const f of fighters) if (f.hp > 0 && t < f.frozen.until) api.heal(f, f.frozen.healPerTick);
  }
  const frozen = (f: SimFighter) => t < f.frozen.until;

  // Dominance Ice: every living holder slows the enemies around it. The slow is a timed buff renewed once it's
  // half spent (one event per renewal, so the stage keeps its ring), so it lingers a moment after an enemy
  // leaves the radius or the holder falls.
  const chillers = fighters.filter((f) => f.chill);
  function fireChills(t: number): void {
    for (const f of chillers) {
      if (f.hp <= 0 || !f.chill) continue;
      const c = f.chill;
      for (const e of fighters) {
        if (e.side === f.side || e.hp <= 0 || dist(f, e) > c.radius) continue;
        const on = e.buffs.find((b) => b.effect === c.effect);
        if (on && on.until - t > (c.linger * TICKS_PER_SECOND) / 2) continue;
        api.buff(e, [{ stat: 'attackSpeed', add: -c.attackSpeed }], c.linger, c.effect, f);
      }
    }
  }

  // Guardian Helmet: living holders heal a share of their max hp once a second (not on the first tick).
  const regenerators = fighters.filter((f) => f.regen > 0);
  function fireRegen(t: number): void {
    if (t === 0 || t % TICKS_PER_SECOND !== 0) return;
    for (const f of regenerators) if (f.hp > 0) api.heal(f, f.maxHp * f.regen);
  }

  // Rising Fury: living heroes gain a share of their starting attack and magic attack once a second, for the
  // first BERSERK_SECONDS seconds.
  const berserkers = fighters.filter((f) => f.berserk);
  function fireBerserk(t: number): void {
    if (t === 0 || t % TICKS_PER_SECOND !== 0 || t > BERSERK_SECONDS * TICKS_PER_SECOND) return;
    for (const f of berserkers) {
      if (f.hp <= 0) continue;
      const b = f.berserk!;
      f.stats = applyMods(f.stats, [{ stat: 'atk', add: b.atk * b.pct }, { stat: 'ap', add: b.ap * b.pct }]);
    }
  }

  // Ruby's Cloak: once a fight, a death is undone: back up with a share of max hp. Every Scythe on its side
  // (its own included) flies into a fury for the rest of the fight.
  function getUp(f: SimFighter, t: number): void {
    f.hp = Math.max(1, Math.round(f.maxHp * f.revive));
    f.revive = 0;
    events.push({ t, type: 'heal', id: f.id, amount: f.hp, hp: f.hp });
    events.push({ t, type: 'buff', id: f.id, by: f.id, effect: 'mastery', until: t + TICKS_PER_SECOND });
    for (const a of fighters) {
      if (a.side !== f.side || a.hp <= 0 || !a.hunt || api.hasBuff(a, 'huntfury')) continue;
      api.buff(a, [{ stat: 'atk', add: a.stats.atk * a.hunt.fury }, { stat: 'ap', add: a.stats.ap * a.hunt.fury }], Infinity, 'huntfury', f);
    }
  }

  // Ruby's Cloak: a basic attack moves its Rage Mark onto the target (if it's still standing).
  function rage(f: SimFighter, target: SimFighter): void {
    if (!f.rageMark || target.hp <= 0 || f.marked === target.id) return;
    if (f.marked !== null) events.push({ t, type: 'buff', id: f.marked, by: f.id, effect: f.rageMark.effect, until: t });
    f.marked = target.id;
    events.push({ t, type: 'buff', id: target.id, by: f.id, effect: f.rageMark.effect });
  }

  // Ruby's Scythe: when ready, strikes the enemy its side's Cloak has marked, wherever it is. Waits for a mark.
  const hunters = fighters.filter((f) => f.hunt);
  function fireHunts(t: number): void {
    for (const f of hunters) {
      if (f.hp <= 0 || t < f.huntNext) continue;
      const marker = fighters.find((m) => m.side === f.side && m.marked !== null && fighters[m.marked].hp > 0 && !frozen(fighters[m.marked]));
      if (!marker) continue;
      const prey = fighters[marker.marked!];
      f.huntNext = t + Math.round(f.hunt!.every * TICKS_PER_SECOND);
      const dealt = damage(prey, Math.max(f.stats.atk, f.stats.ap) * f.hunt!.mult, 'physical', f);
      events.push({ t, type: 'effect', effect: f.hunt!.effect, by: f.id, target: prey.id, damage: dealt, hp: prey.hp });
      afterDamage(prey, t);
    }
  }

  // Revitalize: the first drop under the threshold leaves a healing spring on the holder's tile.
  const springs: { by: number; side: Side; cells: Point[]; heal: number; every: number; next: number; left: number; effect: string }[] = [];
  function checkSpring(f: SimFighter, t: number): void {
    if (!f.spring || f.hp >= f.maxHp * f.spring.below) return;
    const s = f.spring;
    f.spring = null;
    const cells = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: f.x + dx, y: f.y + dy }))).filter((c) => c.x >= 0 && c.y >= 0 && c.x < GRID_W && c.y < GRID_H);
    const every = Math.round(s.every * TICKS_PER_SECOND);
    springs.push({ by: f.id, side: f.side, cells, heal: s.heal, every, next: t, left: Math.round(s.seconds / s.every), effect: s.effect });
    events.push({ t, type: 'ground', effect: s.effect, cells, until: t + Math.round(s.seconds * TICKS_PER_SECOND) });
    fireSprings(t);
  }
  function fireSprings(t: number): void {
    for (const s of springs) {
      if (s.left <= 0 || t < s.next) continue;
      for (const c of s.cells) {
        const id = occupied[gridIndex(c)];
        const ally = id >= 0 ? fighters[id] : null;
        if (ally && ally.side === s.side && ally.hp > 0) api.heal(ally, ally.maxHp * s.heal, fighters[s.by]);
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

  // Executes, ignoring shields: passive ones (see SkillDef.executeBelow), a living executor next to a damaged
  // enemy under its threshold; and Divine Execution, whoever last hurt it holding the card.
  const executors = fighters.filter((f) => {
    const skill = UNIT_BY_ID[f.defId].skill;
    return skill && SKILLS[skill].executeBelow;
  });
  const gifted = fighters.filter((f) => f.gift > 0); // Supreme Blade holders: the same, from the item
  function execute(by: SimFighter, target: SimFighter, effect: string, t: number): void {
    const dealt = target.hp;
    target.hp = 0;
    if (target.killer === null) target.killer = by.id;
    by.dealt += dealt;
    events.push({ t, type: 'effect', effect, by: by.id, target: target.id, damage: dealt, hp: 0 });
    reactToDamage(target, t);
  }
  function checkExecute(target: SimFighter, t: number): void {
    for (const ex of executors) {
      if (ex.hp <= 0 || ex.side === target.side || dist(ex, target) > 1) continue;
      const below = SKILLS[UNIT_BY_ID[ex.defId].skill!].executeBelow![ex.star - 1];
      if (target.hp >= target.maxHp * below) continue;
      return execute(ex, target, 'execute', t);
    }
    for (const ex of gifted) {
      if (ex.hp <= 0 || ex.side === target.side || dist(ex, target) > 1 || target.hp >= target.maxHp * ex.gift) continue;
      return execute(ex, target, 'gift', t);
    }
    // Divine Execution (never through Winter Crown's freeze): the executed one's neighbours take true damage.
    const by = target.lastDealer === null ? null : fighters[target.lastDealer];
    if (!by?.execute || t < target.frozen.until || target.hp >= target.maxHp * by.execute) return;
    const around = fighters.filter((e) => e !== target && e.side === target.side && e.hp > 0 && dist(e, target) <= 1);
    execute(by, target, 'divineExecution', t);
    for (const e of around) {
      if (e.hp <= 0) continue;
      const dealt = damage(e, DIVINE_EXECUTION.splash, 'pure', by);
      events.push({ t, type: 'effect', effect: 'divineSmite', by: by.id, target: e.id, damage: dealt, hp: e.hp });
      reactToDamage(e, t);
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
    dashTo: (who, to, show) => {
      const f = fighters[who.id];
      // Displacement: an enemy's skill moving it. Immune units stay put; a Turret never moves.
      if (f.anchored || (casting && casting.side !== f.side && t < f.ccImmuneUntil)) return;
      occupied[gridIndex(f)] = -1;
      f.x = to.x;
      f.y = to.y;
      occupied[gridIndex(f)] = f.id;
      if (show !== false) events.push({ t, type: 'dash', id: f.id, x: f.x, y: f.y, ...(show && { seconds: show }) });
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
    attack: (who, at, mult) => {
      const f = fighters[who.id];
      const target = fighters[at.id];
      if (f.hp <= 0 || target.hp <= 0) return;
      fullBasicAttack(f, target, t, mult);
    },
    stance: (who, { rooted, noBasic }) => {
      const f = fighters[who.id];
      if (rooted !== undefined) f.rooted = rooted;
      if (noBasic !== undefined) f.noBasic = noBasic;
    },
    ccImmune: (who, seconds) => {
      const f = fighters[who.id];
      f.ccImmuneUntil = Math.max(f.ccImmuneUntil, t + Math.round(seconds * TICKS_PER_SECOND));
    },
    canAct: (who) => {
      const f = fighters[who.id];
      return f.hp > 0 && t >= f.stunnedUntil && !frozen(f);
    },
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
    heal: (who, amount, by) => {
      const f = fighters[who.id];
      const healed = Math.min(f.maxHp - f.hp, Math.round(amount * healMult(f)));
      if (f.hp <= 0 || healed <= 0) return 0;
      f.hp += healed;
      events.push({ t, type: 'heal', id: f.id, amount: healed, hp: f.hp, ...(by && by.id !== f.id && { by: by.id }) });
      return healed;
    },
    minionsOf: (f) => fighters.filter((m) => m.owner === f.id && m.hp > 0),
    dismiss: (who) => {
      const m = fighters[who.id];
      if (m.hp <= 0 || m.owner === null) return;
      m.hp = 0;
      occupied[gridIndex(m)] = -1;
      events.push({ t, type: 'death', id: m.id });
    },
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
        duelRing: null,
        duel: null,
        refund: 0,
        loveBeam: null,
        castMana: 0,
        attackMana: 0,
        chill: null,
        hurtMana: 0,
        deter: null,
        deterStacks: { n: 0, until: 0 },
        regen: 0,
        berserk: null,
        kamikaze: 0,
        perks: { ko: false, quakes: null, valor: null, whirl: false, hail: null, chorus: false, cutthroat: null, spellCrit: false },
        judgement: null,
        fortify: 0,
        dragonShield: 0,
        sharpshooter: 0,
        revive: 0,
        rageMark: null,
        marked: null,
        hunt: null,
        huntNext: 0,
        iceArrow: null,
        arrows: 0,
        killHeal: 0,
        killer: null,
        lastDealer: null,
        vengeance: 0,
        thunder: null,
        thunderReady: 0,
        provoke: null,
        provoked: 0,
        flurry: null,
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
        rooted: false,
        anchored: false,
        execute: 0,
        gift: 0,
        plunder: 0,
        noBasic: false,
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
    shred: (who, by) => {
      const target = fighters[who.id];
      target.shred = Math.max(target.shred, fighters[by.id].stats.armorShred);
    },
    showLeap: (who, to, seconds) => {
      events.push({ t, type: 'dash', id: who.id, x: to.x, y: to.y, seconds, arc: true });
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
      castPerks(f);
    } else if (cast) {
      const dealt = damage(target, f.stats.ap * f.stats.castMult * (1 + f.stats.skillAmp), 'magic', f);
      f.mana = 0;
      hitEvent(f, target, t, 'cast', dealt, false);
      leech(f, dealt, false, t);
      hex(f, target);
      castPerks(f);
    } else {
      fullBasicAttack(f, target, t);
    }
    // Mana straight back after a cast: Angela's protection (a share) and items like Purple Buff (flat).
    if (cast && (f.refund > 0 || f.castMana > 0)) f.mana = Math.min(f.maxMana, f.mana + f.maxMana * f.refund + f.castMana);
    f.nextAttack = t + attackInterval(f.stats);
  }

  // A basic attack plus Fighter's chance to hit again.
  // `mult` scales its damage (a skill's attack, e.g. 140% of attack); items and on-hit effects work as usual.
  function fullBasicAttack(f: SimFighter, target: SimFighter, t: number, mult = 1): void {
    const skill = UNIT_BY_ID[f.defId].skill;
    // A volley skill makes one attack several shots (see SkillDef.volley); the hit-again repeats the whole volley.
    const volley = skill ? SKILLS[skill].volley?.(f) : undefined;
    const once = (again: boolean) => {
      if (!volley) return basicAttack(f, target, t, again, mult);
      for (let n = 0; n < volley.shots && target.hp > 0 && f.hp > 0; n++) basicAttack(f, target, t, again, mult * volley.power, n === 0);
    };
    once(false);
    // Only roll when there's a chance, so fights without it replay exactly as before.
    if (target.hp > 0 && f.hp > 0 && f.stats.hitAgain > 0 && nextFloat(rng) < f.stats.hitAgain) once(true);
    // Great Dragon Spear: a chance of more attacks right after (only rolled when held).
    if (f.flurry && target.hp > 0 && f.hp > 0 && nextFloat(rng) < f.flurry.chance) {
      for (let n = 0; n < f.flurry.hits && target.hp > 0 && f.hp > 0; n++) once(true);
    }
    if (skill && f.hp > 0) SKILLS[skill].afterAttack?.(api, f, target);
  }

  // True while a counter-attack is resolving, so counters never set off more counters.
  let countering = false;

  function basicAttack(f: SimFighter, target: SimFighter, t: number, again: boolean, mult = 1, mana = true): void {
    // Shred lands before the damage, so the first hit already benefits.
    target.shred = Math.max(target.shred, f.stats.armorShred);
    // Only roll when there's a chance, so crit-free fights replay exactly as before crits existed.
    const crit = f.stats.critChance > 0 && nextFloat(rng) < f.stats.critChance;
    // Physical attackers hit with attack, magic attackers with magic attack.
    const type = UNIT_BY_ID[f.defId].attackType ?? 'physical';
    const power = type === 'magic' ? f.stats.ap : f.stats.atk;
    const dealt = damage(target, power * mult * (1 + f.stats.basicAmp) * (crit ? f.stats.critDamage : 1), type, f);
    if (mana) gainMana(f, MANA_PER_ATTACK + f.attackMana);
    stackUp(f, 'basic');
    hitEvent(f, target, t, 'attack', dealt, crit, again);
    leech(f, dealt, true, t);
    engulf(f, target);
    rage(f, target);
    thunderStrike(f, target);
    iceVolley(f, target);
    ignite(f, target);
    if (dealt > 0) sheepOnHit(f, target);
    // Cutthroat: when ready, this attack adds adaptive damage, then it recharges.
    if (f.perks.cutthroat !== null && t >= f.perks.cutthroat && target.hp > 0) {
      f.perks.cutthroat = t + Math.round(CUTTHROAT.every * TICKS_PER_SECOND);
      const extra = damage(target, adaptivePower(f.stats) * CUTTHROAT.adaptive, 'adaptive', f);
      events.push({ t, type: 'effect', effect: 'cutthroat', by: f.id, target: target.id, damage: extra, hp: target.hp });
      afterDamage(target, t);
    }
    // KO Punch: a chance to stun (rolled only for heroes with it).
    if (f.perks.ko && dealt > 0 && target.hp > 0 && nextFloat(rng) < KO_PUNCH.chance) disable(target, KO_PUNCH.seconds, f, 'koPunch');
    // Its summons repeat the hit on the same target, crit and all. They copy the hit itself, not the
    // owner's damage bonuses (those are the owner's alone).
    for (const m of fighters) {
      if (m.owner !== f.id || !m.mirror || m.hp <= 0 || target.hp <= 0) continue;
      const raw = power * mult * (1 + f.stats.basicAmp) * m.mirror * (crit ? f.stats.critDamage : 1);
      hitEvent(m, target, t, 'attack', damage(target, raw, type, m), crit, again);
    }
    const skill = UNIT_BY_ID[f.defId].skill;
    if (skill) SKILLS[skill].onBasicHit?.(api, f, target);
    const theirs = UNIT_BY_ID[target.defId].skill;
    if (theirs && !countering && target.hp > 0) SKILLS[theirs].onAttacked?.(api, target, f);
  }

  // Logs an attack or placeholder cast, then lets the target react (mana, death, triggers).
  function hitEvent(f: SimFighter, target: SimFighter, t: number, type: 'attack' | 'cast', dealt: number, crit: boolean, again = false): void {
    gainMana(target, MANA_PER_HIT_TAKEN * (1 + target.hurtMana));
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
  const claw = [crushingClawOf(home), crushingClawOf(away)];
  const pulses = ([0, 1] as const).flatMap((side) =>
    traitPulses(traits[side]).map(({ trait, pulse }) => ({ side, trait, pulse, every: Math.round(pulse.every * TICKS_PER_SECOND) })),
  );
  function firePulses(t: number): void {
    for (const { side, trait, pulse, every } of pulses) {
      if (t === 0 || t % every !== 0 || t / every > pulse.times) continue;
      for (const target of fighters) {
        if (target.side === side || target.hp <= 0) continue;
        // Crushing Claw: Skybringer lightning hits harder, as pure damage, and lowers defenses for the fight.
        const crush = claw[side] && trait === 'skybringer';
        const raw = target.maxHp * pulse.pctMaxHp * (crush ? 1 + CRUSHING_CLAW.damage : 1);
        const dealt = damage(target, raw, crush ? 'pure' : pulse.damageType, null);
        events.push({ t, type: 'effect', effect: trait, target: target.id, damage: dealt, hp: target.hp });
        afterDamage(target, t);
        if (crush && target.hp > 0 && !target.debuffs.some((d) => d.effect === 'crushingClaw')) {
          target.debuffs.push({ effect: 'crushingClaw', armor: CRUSHING_CLAW.def, mr: CRUSHING_CLAW.def, until: MAX_COMBAT_TICKS });
          events.push({ t, type: 'debuff', id: target.id, by: -1, effect: 'crushingClaw', armor: CRUSHING_CLAW.def, mr: CRUSHING_CLAW.def, until: MAX_COMBAT_TICKS });
        }
      }
    }
  }

  // The centre of the 3x3 holding the most living enemies of `f` (ties: the one nearest `f`), or null if none.
  function densest3x3(f: { x: number; y: number; side: number }): Point | null {
    const foes = fighters.filter((e) => e.side !== f.side && e.hp > 0);
    let best: { p: Point; n: number; d: number } | null = null;
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        const n = foes.filter((e) => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1).length;
        const d = Math.max(Math.abs(x - f.x), Math.abs(y - f.y));
        if (n && (!best || n > best.n || (n === best.n && d < best.d))) best = { p: { x, y }, n, d };
      }
    }
    return best?.p ?? null;
  }

  // Item pulses (e.g. Keris' Justice): from a living holder, hitting every living enemy (or those in the
  // densest 3x3). They fire even while the holder is stunned.
  // Angela's card: each beaming hero shoots a 2-wide line through its target (or the nearest enemy) to the board's
  // edge, healing allies on it and hitting enemies.
  function fireLoveBeams(t: number): void {
    if (t === 0) return;
    for (const f of fighters) {
      const beam = f.loveBeam;
      if (!beam || f.hp <= 0 || t % beam.every !== 0) continue;
      const enemies = fighters.filter((e) => e.side !== f.side && e.hp > 0);
      if (!enemies.length) continue;
      const aim = f.target && f.target.hp > 0 ? f.target : nearest(f, enemies);
      if (aim.x === f.x && aim.y === f.y) continue;
      for (const c of loveBeam(api, f, aim)) {
        const there = fighters.find((o) => o.hp > 0 && o.x === c.x && o.y === c.y);
        if (!there) continue;
        if (there.side === f.side) api.heal(there, there.maxHp * beam.heal, f);
        else {
          const dealt = damage(there, beam.damage, 'magic', f);
          events.push({ t, type: 'effect', effect: 'lovebeam', by: f.id, target: there.id, damage: dealt, hp: there.hp });
          afterDamage(there, t);
        }
      }
    }
  }

  function fireItemPulses(t: number): void {
    if (t === 0) return;
    for (const f of fighters) {
      for (const pulse of f.pulses) {
        if (f.hp <= 0 || t % pulse.every !== 0) continue;
        const zone = pulse.area === '3x3' ? densest3x3(f) : null;
        for (const target of fighters) {
          if (target.side === f.side || target.hp <= 0) continue;
          if (zone && (Math.abs(target.x - zone.x) > 1 || Math.abs(target.y - zone.y) > 1)) continue;
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

  // Fortified Defense: a hero with full item slots shields itself and its left and right neighbours for the fight.
  function fireFortify(): void {
    for (const f of fighters) {
      if (!f.fortify) continue;
      for (const ally of fighters) {
        if (ally.side !== f.side || ally.hp <= 0 || ally.y !== f.y || Math.abs(ally.x - f.x) > 1) continue;
        ally.shields.push({ effect: `fortify${f.id}`, amount: f.fortify, until: MAX_COMBAT_TICKS, onEnd: null });
        shieldEvent(ally);
      }
    }
  }

  // Oracle: when the fight starts, every ally in the holder's row (the holder too) is buffed for the whole fight.
  // (Enhanced Oracle's max hp is given at deploy, above.)
  function fireRowBuffs(): void {
    for (const f of fighters) {
      const held = new Map(f.items.flatMap(({ id }) => (ITEMS[id].rowBuff ? [[ITEMS[id].rowBuff!.effect, ITEMS[id].rowBuff!] as const] : [])));
      for (const b of held.values()) {
        for (const ally of fighters) {
          if (ally.side !== f.side || ally.hp <= 0 || ally.y !== f.y || api.hasBuff(ally, b.effect)) continue;
          api.buff(ally, b.mods, Infinity, b.effect, f);
        }
      }
    }
  }

  // Ancient Wrath: when the fight starts, the holder taunts the enemy in front of it (the nearest) and those around that one.
  const provokers = fighters.filter((f) => f.provoke);
  function fireProvoke(): void {
    for (const f of provokers) {
      const foes = fighters.filter((e) => e.side !== f.side && e.hp > 0);
      if (!foes.length) continue;
      // In front: the nearest; ties go to the one most straight ahead (same column), then the lower id.
      const front = foes.reduce((x, y) => (dist(f, y) - dist(f, x) || Math.abs(y.x - f.x) - Math.abs(x.x - f.x) || y.id - x.id) < 0 ? y : x);
      for (const e of foes) if (dist(e, front) <= f.provoke!.radius) api.taunt(e, f, f.provoke!.seconds);
    }
    updateProvoked(t);
  }
  // ...and has more armor and magic resist for every enemy after it, recounted each tick. The buff (and its
  // ring) changes only when the count does; at zero it's taken off, its ring with it.
  function updateProvoked(t: number): void {
    for (const f of provokers) {
      const n = f.hp > 0 ? fighters.filter((e) => e.side !== f.side && e.hp > 0 && e.target === f).length : 0;
      if (n === f.provoked) continue;
      f.provoked = n;
      const p = f.provoke!;
      if (n === 0) {
        api.unbuff(f, p.effect);
        events.push({ t, type: 'buff', id: f.id, by: f.id, effect: p.effect, until: t });
      } else {
        api.buff(f, [{ stat: 'armor', add: p.perTargeter * n }, { stat: 'mr', add: p.perTargeter * n }], Infinity, p.effect, f);
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
    fireDuelStart();
    fireOpeners();
    fireSideShields();
    fireFortify();
    firePerks(0); // Hail of Shots: its full speed from the start
    fireDisco(0);
    fireRowBuffs();
    fireProvoke();
    fireBeasts();
    fireSheep();
    firePlunder();
    // Skill passives, from the starting positions; ones that move the unit last.
    for (const late of [false, true]) {
      for (const f of fighters) {
        const skill = UNIT_BY_ID[f.defId].skill;
        if (skill && !!SKILLS[skill].atStartLate === late) SKILLS[skill].atStart?.(api, f);
      }
    }
  }

  const shownMana = new Map<number, number>();
  for (; t < MAX_COMBAT_TICKS && alive(0) && alive(1); t++) {
    for (const f of fighters) if (f.hp > 0) gainMana(f, f.stats.manaRegen / TICKS_PER_SECOND);
    // Regen moves mana between hits; without this the bar would only catch up on the next attack.
    if (t % MANA_REPORT_TICKS === 0) {
      const mana: [number, number][] = [];
      for (const f of fighters) {
        if (f.hp <= 0 || !f.stats.manaRegen) continue;
        const now = Math.floor(f.mana);
        if (shownMana.get(f.id) !== now) mana.push([f.id, now]);
        shownMana.set(f.id, now);
      }
      if (mana.length) events.push({ t, type: 'mana', mana });
    }
    firePulses(t);
    fireItemPulses(t);
    fireLoveBeams(t);
    fireRepeats(t);
    fireGround(t);
    fireSprings(t);
    fireBurns(t);
    fireFrozen(t);
    fireChills(t);
    fireRegen(t);
    fireBerserk(t);
    firePerks(t);
    if (t > 0) fireDisco(t);
    fireOvertime(t);
    fireHunts(t);
    fireDuels(t);
    updateProvoked(t);
    flushVengeance(t); // any reflection whose hit wasn't followed by afterDamage
    expireBuffs(t);
    expireShields(t);

    // Shuffled each tick so neither side always strikes first.
    for (const f of shuffle(rng, fighters.filter((f) => f.hp > 0))) {
      if (f.hp <= 0 || t < f.stunnedUntil || t < f.busyUntil || frozen(f)) continue;
      // Frozen enemies (Winter Crown) can't be targeted.
      // A duelist sees only its opponent; nobody else sees a duelist.
      const enemies = dueling(f)
        ? [fighters[f.duel!.with]]
        : fighters.filter((e) => e.side !== f.side && e.hp > 0 && !frozen(e) && !dueling(e));
      if (enemies.length === 0) continue;

      // A taunted unit goes after its taunter; otherwise it sticks with its target while alive and in range.
      const taunter = f.taunt && t < f.taunt.until ? fighters[f.taunt.by] : null;
      if (dueling(f)) f.target = enemies[0];
      else if (taunter && taunter.hp > 0 && !frozen(taunter) && !dueling(taunter)) f.target = taunter;
      else if (!f.target || f.target.hp <= 0 || frozen(f.target) || dueling(f.target) || dist(f, f.target) > f.stats.range) f.target = nearest(f, enemies);
      const target = f.target;

      // A duelist: basic attacks only, whatever it is.
      if (dueling(f)) {
        if (dist(f, target) <= f.stats.range) {
          if (t >= f.nextAttack) {
            fullBasicAttack(f, target, t);
            f.nextAttack = t + attackInterval(f.stats);
          }
        } else if (!f.rooted && t >= f.nextMove) advance(f, target, t);
      } else if (f.noBasic) {
        if (t >= f.nextAttack && f.mana >= f.maxMana) strike(f, target, t);
      } else if (dist(f, target) <= f.stats.range) {
        if (t >= f.nextAttack) strike(f, target, t);
      } else if (!f.rooted && t >= f.nextMove) {
        advance(f, target, t);
      }
    }
  }

  fireDuels(t); // a duel decided by the fight's last blow

  const a0 = alive(0);
  const a1 = alive(1);
  const winner: Side | null = a0 && !a1 ? 0 : a1 && !a0 ? 1 : null;
  // Summons don't count toward the damage the loser takes.
  const survivors = winner === null ? [] : fighters.filter((f) => f.side === winner && f.hp > 0 && f.owner === null).map(snapshot);
  return { fighters: start, traits, events, ticks: t, winner, survivors };
}
