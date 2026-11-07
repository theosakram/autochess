import type { Opener } from '../effects';
import type { DamageType, StatKey, StatMod } from '../stats';

export type ItemKind = 'offense' | 'defense' | 'utility';

// What an equipment item builds up, for grouping it (gallery, popups). Every equipment has one.
export type EquipmentGroup = 'physical' | 'magic' | 'hybrid' | 'armor';
export const EQUIPMENT_GROUPS: { id: EquipmentGroup; name: string }[] = [
  { id: 'physical', name: 'Physical' },
  { id: 'magic', name: 'Magic' },
  { id: 'hybrid', name: 'Hybrid' },
  { id: 'armor', name: 'Armor' },
];

// Every `every` seconds the holder hits all enemies for `atkPct` of its attack.
export interface ItemPulse {
  every: number;
  atkPct: number;
  damageType: DamageType;
}

// While the holder is fielded, every member of trait `to` on its side gains `share` x the holder's
// highest of `from`, added to each of `stats`.
export interface ItemAura {
  to: string;
  from: StatKey[];
  stats: StatKey[];
  share: number;
}

// A passive that builds up as the holder fights: every damaging hit (`on: 'damage'`, the default) or every
// basic attack (`on: 'basic'`) adds a stack (up to `max`), each worth `perStack`; at max stacks `atMax`
// applies too. Stacks last `seconds` from the latest one (Infinity: the whole fight).
// Unique: the same passive from two copies on one unit counts once.
export interface StackingPassive {
  effect: string; // its name, also the id that keeps it unique
  on?: 'damage' | 'basic';
  perStack: StatMod[];
  atMax: StatMod[];
  max: number;
  seconds: number;
}

// When a fight starts, the holder and the allies directly left and right of it get a shield of `share` of
// their own max hp for `seconds`. Unique: one per holder, however many copies it holds.
export interface SideShield {
  effect: string;
  share: number;
  seconds: number;
}

// The first time the holder drops below `below` of its max hp in a fight, a spring appears on its tile:
// for `seconds` it heals every ally in the 3x3 around that spot for `heal` of their own max hp, every
// `every` seconds (starting right away). Once per fight; it stays put even if the holder moves or dies.
export interface HealingSpring {
  effect: string;
  below: number;
  seconds: number;
  every: number;
  heal: number;
}

// Hitting a target under `below` of its max hp gives the holder +`amp` damage for `seconds`, starting
// with that very hit. Unique: one per holder.
export interface LowHpFury {
  effect: string;
  below: number;
  amp: number;
  seconds: number;
}

// An item is data plus hooks, like a trait. Tiers start at 1.
export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  kind: ItemKind;
  group?: EquipmentGroup; // equipment only (see EQUIPMENT_GROUPS)
  // Works only while this trait is active for the holder's side. None: equipment, which always works
  // (dropped by monster rounds, see equipment.ts).
  trait?: string;
  maxTier: number;
  tierFromTrait?: boolean; // works at its trait's level instead of an upgradable tier
  forbidden?: string; // members of this trait can't hold it
  membersOnly?: true; // only members of its `trait` can hold it
  // One sentence for every tier; each {key} is filled from values(), one value per tier.
  desc: string;
  values(): Record<string, string[]>;
  mods(tier: number): StatMod[];
  pulse?(tier: number): ItemPulse;
  opener?(tier: number): Opener;
  aura?(tier: number): ItemAura;
  stacking?: StackingPassive;
  // Unique attribute: stats a unit gets once, however many copies of this item it holds.
  unique?(tier: number): StatMod[];
  sideShield?: SideShield;
  // When a fight starts, the holder can't be stunned, taunted or moved by enemies for this many seconds.
  ccImmune?: number;
  spring?: HealingSpring;
  lowHpFury?: LowHpFury;
  // Unique: every basic attack (plain or enhanced) also deals this share of the target's max hp as physical damage.
  engulf?: number;
  // Unique: any damage the holder deals cuts the target's healing by `cut` for `seconds` (refreshed per hit).
  lifebane?: { cut: number; seconds: number };
  // Unique: the holder's skill damage puts `mods` on the target for `seconds` (refreshed per hit, never stacked).
  skillHex?: { effect: string; mods: { stat: StatKey; add: number }[]; seconds: number };
  // Unique: the holder's skill damage burns the target for `seconds`: every second, magic damage of `share` of
  // its max hp (at least `min`), and its healing is cut by `cut` for as long. Refreshed per hit, never stacked.
  scorch?: { effect: string; share: number; min: number; seconds: number; cut: number };
  // Unique, once per fight: when the holder drops below `below` of its max hp, or takes a hit that would
  // kill it (it's left at 1 hp instead), it freezes for `seconds`: it can't act, takes no damage, enemies
  // can't target it, and it heals `heal` of its max hp over that time.
  freeze?: { below: number; seconds: number; heal: number };
  // Unique aura: while the holder lives, enemies within `radius` cells lose `attackSpeed` (a timed buff, kept
  // refreshed; it lasts `linger` seconds after they leave). Several holders on one side don't stack.
  chill?: { effect: string; radius: number; attackSpeed: number; linger: number };
  // Unique: an enemy that damages the holder loses `perStack` of its attack and magic attack per stack, up to
  // `max` stacks, all lasting `seconds` from the latest. Several holders share one stack count on that enemy.
  deter?: { effect: string; perStack: number; max: number; seconds: number };
  // Unique: a basic attack that damages the holder sends this share of that damage back to the attacker, as
  // physical damage (the attacker's armor applies). Even on a killing blow.
  vengeance?: number;
  // Unique: a charge every `every` seconds (charged at the start): the holder's next basic attack also deals
  // `share` of the holder's max hp as magic damage to its target and every enemy within `radius` of it.
  thunder?: { effect: string; every: number; share: number; radius: number };
  // Unique: when a fight starts, every other ally in the holder's row gets `mods` for the whole fight. Several
  // holders in one row don't stack (one buff per effect).
  rowBuff?: { effect: string; mods: { stat: StatKey; add: number }[] };
  // Unique: when a fight starts, enemies within `radius` cells are taunted for `seconds`. All fight long, the
  // holder has +`perTargeter` armor and magic resist for every living enemy whose target it is.
  provoke?: { effect: string; radius: number; seconds: number; perTargeter: number };
  // Unique, once a fight: when the holder dies, it gets back up with this share of its max hp instead.
  revive?: number;
  // Unique: the holder's basic attacks put a mark on their target (one enemy at a time, moving to the latest);
  // when the marked enemy dies, the holder heals `heal` of its max hp. Hunt (below) strikes the marked enemy.
  rageMark?: { effect: string; heal: number };
  // Unique: every `every` seconds, strikes the enemy marked by an ally's (or its own) rageMark item, anywhere,
  // for `mult` x its higher of attack and magic attack, physical. When an ally's (or its own) revive item gets
  // it back up, the holder gains `fury` of its attack and magic attack for the rest of the fight.
  hunt?: { effect: string; every: number; mult: number; fury: number };
  // Unique: the holder heals this share of its max hp every second (healing cuts apply).
  regen?: number;
  // Unique: whenever the holder kills an enemy, the living ally with the lowest share of its max hp heals this
  // share of its own max hp.
  killHeal?: number;
  // Unique: mana the holder gains from taking hits is multiplied by 1 + this.
  hurtMana?: number;
  // Unique: the holder starts every fight with this share of its max mana.
  startMana?: number;
  // Unique: flat mana the holder gets back right after every skill cast.
  castMana?: number;
  // Unique: polymorph. When a fight starts, the enemy with the highest star (ties: higher cost) is turned into a
  // sheep for `opening` seconds (like a stun: no moving, attacking or casting). Its basic attacks that deal damage
  // turn their target into a sheep for `onHit` seconds, at most once every `cooldown` seconds.
  sheep?: { opening: number; onHit: number; cooldown: number };
  // Item slots it takes on its holder (default 1); it also counts as that many items wherever item count
  // matters (e.g. who leads a trait, Angela's halo).
  slots?: number;
  // Unique: each fight, the holder also gets this many different random equipment copied from the pool
  // (never itself), for that fight only.
  copies?: number;
  // Never dropped, offered or copied: only a commander card hands it out.
  exclusive?: true;
  // Unique: every `kills` enemies the holder kills, across fights, earn an Equipment Chest, up to `max` a game.
  chests?: { kills: number; max: number };
  // A basic item: offered on BASIC_ITEM_ROUND (pick 1 of a few), never dropped by monsters.
  basic?: true;
  // Its tier is the game's stage (I = 1, II = 2, ...; see config.stageRound), up to maxTier; set every round.
  tierByStage?: true;
  // The holder gets this trait's member bonuses without counting toward it; `icon` marks it.
  grantsMembership?: { trait: string; icon: string };
}
