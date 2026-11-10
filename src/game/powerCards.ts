import { rewardUnit } from './sync';
import { BOARD_COLS, BOARD_ROWS, CARD_OFFER_SIZE, INTEREST_PER_10, MAX_INTEREST, roundAt, roundLabel, MAX_ITEMS_PER_UNIT, POWER_CARD_ROUNDS, SHOP_ODDS } from './config';
import { canClaimToBoard, gainUnit, giveStarred, giveTwoStar } from './actions';
import { mergeUnits } from './merge';
import { openChest } from './inventory';
import { addXp } from './player';
import { drawFromTier } from './shop';
import { nextFloat, nextInt, shuffle } from './rng';
import { enhanceItem, EQUIPMENT, ITEMS } from './items';
import type { StatMod } from './stats';
import { orbTraits, TRAITS } from './traits';
import type { GameState, Player, PowerDeal, PowerOffer, PowerTier, Star } from './types';
import { openTreasure, raisedTier } from './treasure';
import { JOHNNIE_FACTIONS, JOHNNIE_ROLES, turretId, UNIT_BY_ID, UNITS } from './units';

// Power cards: picked on POWER_CARD_ROUNDS, at the tier the match rolled for that round (blue I, purple II,
// gold III). Each card's numbers are by tier.
export interface PowerCardDef {
  id: string;
  name: string;
  icon: string;
  desc: (tier: PowerTier) => string;
  tiers?: PowerTier[]; // only offered at these tiers (default: all)
  attackMana?: Record<PowerTier, number>; // heroes holding equipment: bonus mana on every basic attack
  hybridLifesteal?: Record<PowerTier, number>; // every fielded hero: lifesteal and spell lifesteal
  freeRefreshChance?: Record<PowerTier, number>; // a manual shop refresh: chance of a free one banked
  berserk?: Record<PowerTier, number>; // every hero: share more atk/ap each second alive, up to BERSERK_SECONDS
  kamikaze?: Record<PowerTier, number>; // every hero: on death, share of its max hp at the enemies around it
  sharpshooter?: Record<PowerTier, number>; // every hero: share more damage per tile between it and its target
  lucky?: Record<PowerTier, [number, number]>; // gold on the pick: one or the other, 50/50
  pickGold?: Partial<Record<PowerTier, number>>; // gold on the pick
  teamwork?: Record<PowerTier, number>; // heroes in a synergy of TEAMWORK_COUNT+: share more attack/magic attack, per such synergy
  loaded?: Record<PowerTier, number>; // heroes holding MAX_ITEMS_PER_UNIT items: share more damage
  allRound?: Record<PowerTier, { hp: number; def: number; atk: number }>; // every hero: flat max hp, flat armor and mr, share more attack and magic attack
  costAtkSpeed?: Partial<Record<PowerTier, { below?: number; atLeast?: number; speed: number }>>; // heroes costing under `below` / `atLeast` or more: attack speed
  twins?: Partial<Record<PowerTier, { atk: number; hp: number }>>; // a hero fielded with another copy of itself: share more attack, magic attack and max hp
  starGift?: Partial<Record<PowerTier, boolean>>; // a hero reaching 3★: a 2★ copy of it, pool or not
  skillAmp?: Record<PowerTier, number>; // every hero: share more skill damage
  castRefund?: Record<PowerTier, number>; // every hero: share of max mana back after each cast
  backMana?: Record<PowerTier, number>; // back-row heroes: share of max mana at the start of a fight
  factionOrbChoices?: Record<PowerTier, number>; // a faction or role orb, chosen out of this many random factions and roles
  frontDef?: Record<PowerTier, number>; // front-row heroes: flat armor and magic resist
  frontHp?: Record<PowerTier, number>; // front-row heroes: flat max hp
  edgeAtk?: Record<PowerTier, number>; // heroes on the leftmost and rightmost columns: share more attack/magic attack
  pickRerolls?: Record<PowerTier, number>; // free shop refreshes banked on the pick
  pickShield?: Partial<Record<PowerTier, number>>; // commander shield on the pick
  roundHeal?: Record<PowerTier, number>; // commander hp healed at the start of every round (up to START_HP)
  xpCut?: Record<PowerTier, number>; // share less XP needed for each level
  promoteNext?: Partial<Record<PowerTier, number>>; // the next heroes bought (this many) come 2★
  dragonShield?: Partial<Record<PowerTier, number>>; // an ally dying: Dragon Altar heroes get a shield of this share of its max hp
  fortify?: Partial<Record<PowerTier, number>>; // a hero with full item slots: a shield this big on it and its left and right neighbours
  allAtk?: Partial<Record<PowerTier, number>>; // every hero: share more attack and magic attack
  hurtExtra?: Partial<Record<PowerTier, number>>; // the commander takes this much more damage on a lost fight
  mercenary?: Partial<Record<PowerTier, { cost: number; damage: number; hp: number }>>; // a random hero of this cost, with a permanent buff
  backRisk?: Partial<Record<PowerTier, { hp: number; damage: number }>>; // back-row heroes: share less max hp, share more damage
  badge?: Partial<Record<PowerTier, string>>; // this trait's orb and a random 2-cost hero with it
  pickChests?: Partial<Record<PowerTier, number>>; // Equipment Chests on the pick (pick one of the offered equipment)
  legacy?: Partial<Record<PowerTier, number>>; // a random faction orb and this many random heroes of that faction
  twoStarRecruit?: Partial<Record<PowerTier, number>>; // a random 2★ hero of this cost, on the pick
  recruits?: Partial<Record<PowerTier, { count: number; cost: number }>>; // random heroes of a cost from the pool, on the pick
  payday?: Record<PowerTier, { gold: number; rounds: number }>;
  rift?: Partial<Record<PowerTier, { souls: number }>>; // souls now, and a second (different) Plane Wanderer, 2★ from EMERGENCY_RIFT.round
  offerings?: Partial<Record<PowerTier, { extra: number; share: number }>>; // Cult of Fire: more Pyre Offerings, each at this share
  transmute?: Partial<Record<PowerTier, number>>; // after this many rounds, the card becomes a random gold power card
  perk?: Partial<Record<PowerTier, Perk>>; // a combat perk for the heroes of one trait (see PERKS)
  signature?: Partial<Record<PowerTier, string>>; // a 3★ copy of this 1-cost hero, with SIGNATURE's buff
  refreshEvery?: Partial<Record<PowerTier, number>>; // a free shop refresh every this many rounds (banked)
  judgement?: Partial<Record<PowerTier, boolean>>; // Astral Sovereigns: a pure bolt at each enemy their skill hits (ASTRAL_JUDGEMENT)
  crushingClaw?: Partial<Record<PowerTier, boolean>>; // Skybringer lightning: more damage, pure, lowers armor and mr (CRUSHING_CLAW)
  chestEvery?: Record<PowerTier, number>; // an Equipment Chest on the pick, then one every this many rounds
  pickXp?: Partial<Record<PowerTier, number>>; // XP on the pick
  pickMirrors?: Partial<Record<PowerTier, number>>; // Mirror Devices on the pick
  chestTriggers?: Partial<Record<PowerTier, ChestTrigger[]>>; // Equipment Chests once a condition is met (each once)
  pickItem?: Partial<Record<PowerTier, string>>; // an equipment (tier 1) to the inventory on the pick
  pickItems?: Partial<Record<PowerTier, string[]>>; // several, likewise
  enhances?: Partial<Record<PowerTier, string[]>>; // these items are enhanced: the ones owned now and every one gained later
  novelItems?: Partial<Record<PowerTier, number>>; // this many random equipment (different), enhanced, and kept enhanced like `enhances`
  heroCap?: Partial<Record<PowerTier, number>>; // more heroes allowed on the board
  pickRefreshes?: Partial<Record<PowerTier, number>>; // free shop refreshes on the pick
  levelRefreshes?: Partial<Record<PowerTier, number>>; // free shop refreshes with each level gained
  traitGold?: Partial<Record<PowerTier, number>>; // after each fight: gold per active synergy
  bloodRefreshes?: Partial<Record<PowerTier, number>>; // this many shop refreshes cost 1 hp instead of gold
  pickDuplicators?: Partial<Record<PowerTier, number>>; // Equipment Duplicators on the pick
  claim?: Partial<Record<PowerTier, { store: number; full: number }>>; // wins store gold; a loss or a full store pays it
  refreshXp?: Partial<Record<PowerTier, number>>; // XP from the first manual shop refresh each round
  turrets?: Partial<Record<PowerTier, number>>; // this many Turrets, each a random faction and role
  execute?: Partial<Record<PowerTier, number>>; // your heroes' damage finishes enemies under this share of max hp
  disco?: Partial<Record<PowerTier, true>>; // fights: enemies dance on a timer; the strongest heroes hit harder
  constellation?: Partial<Record<PowerTier, true>>; // hybrid attack per active synergy
  fortune?: Partial<Record<PowerTier, number>>; // after this many rounds, the card's commander shield left turns to gold
  interestCap?: Partial<Record<PowerTier, number>>; // the interest limit becomes this
  freeBuy?: Partial<Record<PowerTier, true>>; // each round's first hero bought is free
  sharpArmory?: Partial<Record<PowerTier, { pct: number; max: number }>>; // back row: attack and magic attack per basic attack
  allyCall?: Partial<Record<PowerTier, true>>; // each star-up gives a 1★ hero sharing a trait with it
  fullyArmed?: Partial<Record<PowerTier, true>>; // fights: heroes holding nothing borrow equipment
  levelCap?: Partial<Record<PowerTier, number>>; // the highest level the player can reach
  offerIf?: (p: Player) => boolean; // offered (and transmuted into) only while this holds
  shopOdds?: Partial<Record<PowerTier, { up: number; down: number[] }>>; // shop odds: cost `up` +CUSTOM_UP points, costs `down` -CUSTOM_DOWN
  antiHeal?: Record<PowerTier, number>; // every hero: its damage cuts the target's healing by this share, for DARK_BLADE_SECONDS // gold on the pick, then as much for `rounds` rounds
}

// Commander hp below `hpBelow`, or the player at `level` or higher: `chests` Equipment Chests and `gold`, once.
export interface ChestTrigger {
  hpBelow?: number;
  level?: number;
  chests?: number;
  gold?: number;
  unit?: string; // a 1★ copy of this hero (from the pool if it has one); waits for room
}

export const TIER_NUMERAL: Record<PowerTier, string> = { blue: 'I', purple: 'II', gold: 'III' };

const MAGIC_SURGE = { blue: 4, purple: 6, gold: 12 };
const BREATH_OF_THE_WILD = { blue: 0.08, purple: 0.16, gold: 0.32 };
const PREMIUM_CLIENT = { blue: 0.25, purple: 0.35, gold: 0.45 };
export const BERSERK_SECONDS = 15;
const BERSERK = { blue: 0.01, purple: 0.02, gold: 0.03 };
const KAMIKAZE = { blue: 0.1, purple: 0.2, gold: 0.3 };
const SHARPSHOOTER = { blue: 0.06, purple: 0.08, gold: 0.1 };
const FEELING_LUCKY: Record<PowerTier, [number, number]> = { blue: [5, 10], purple: [7, 14], gold: [9, 18] };
const HEALING_FOUNTAIN = { blue: 3, purple: 4, gold: 5 }; // gold on the pick
const HEALING_FOUNTAIN_HEAL = { blue: 2, purple: 3, gold: 4 }; // commander hp each round
const PALADIN = { blue: 20, purple: 30, gold: 40 };
const SHOPPING_SPREE = { blue: 9, purple: 13, gold: 19 };
const SOLID_FRONT = { blue: 20, purple: 35, gold: 50 };
const FRONTIER_BLITZ = { blue: 0.1, purple: 0.2, gold: 0.3 };
const BARRIERS_SEAL = { blue: 650, purple: 1000, gold: 1500 };
const MANA_SOVEREIGN = { blue: 0.25, purple: 0.5, gold: 0.75 };
const ANGELS_BLESSING = { amp: { blue: 0.1, purple: 0.2, gold: 0.3 }, refund: { blue: 0.1, purple: 0.15, gold: 0.2 } };
const ALL_ROUND_WARRIOR = {
  blue: { hp: 160, def: 10, atk: 0.05 },
  purple: { hp: 320, def: 20, atk: 0.1 },
  gold: { hp: 480, def: 30, atk: 0.15 },
};
const ELITE_TEAM = { below: 3, speed: 0.3 };
const PEERLESS_VALOR = { atLeast: 4, speed: 0.25 };
const PAS_DE_DEUX = { atk: 0.3, hp: 0.3 };
const FULLY_LOADED = { blue: 0.1, purple: 0.2, gold: 0.3 };
export const TEAMWORK_COUNT = 6;
const TEAMWORK = { blue: 0.2, purple: 0.25, gold: 0.3 };
const PRIME_SELECTION = 3;
const FAST_GROWTH = { blue: 0.15, purple: 0.2, gold: 0.25 };
const FAST_GROWTH_XP = { gold: 5 }; // XP on the pick, gold only
const EXCELLENT_RECRUIT = { blue: { count: 3, cost: 3 }, purple: { count: 3, cost: 4 } };
const CYCLICAL_SUPPORT = { blue: 8, purple: 7, gold: 6 };
const JUMP_THE_GUN = { blue: 11, purple: 18, gold: 25 };
export const DARK_BLADE_SECONDS = 5; // as long as Sea Halberd's Lifebane
const DARK_BLADE = { blue: 0.3, purple: 0.4, gold: 0.5 };
const ROGUES_AID = { blue: 'thieftool' };
// Gustiwana Unbound: its items enhanced, and free refreshes.
// Novel Equipment: random equipment, enhanced (and kept so).
export const NOVEL_EQUIPMENT = 3;
export const GUSTIWANA_UNBOUND = { items: ['keris', 'blangkon', 'jimat'], refreshes: 5 };
// Purple cards that give an enhanced item, and enhance every copy of it from then on.
export const ENHANCING_CARDS = [
  { id: 'manicSlam', name: 'Manic Slam', icon: '🔨', item: 'goldenstaff' },
  { id: 'howlingWind', name: 'Howling Wind', icon: '🌬️', item: 'wintercrown' },
  { id: 'totalDomination', name: 'Total Domination', icon: '👑', item: 'dominanceice' },
  { id: 'brightSunshine', name: 'Bright Sunshine', icon: '☀️', item: 'oracle' },
  { id: 'bloodClaw', name: 'Blood Claw', icon: '🐾', item: 'haasclaw' },
  { id: 'talismanUnleashed', name: 'Talisman Unleashed', icon: '✨', item: 'spellbladetalisman' },
  { id: 'gloriousRogue', name: 'Glorious Rogue', icon: '🎭', item: 'thieftool' },
];
const CUSTOM_UP = 10;
const CUSTOM_DOWN = 5;
const CUSTOMIZE_RECRUITMENT = { blue: { up: 3, down: [1, 2] }, purple: { up: 4, down: [1, 2, 3] } };
const FATEFUL_DICE = { purple: 1 };
const COUNTER_ACTION = { hp: 55, chests: 3 };
const APEX_WEAPONRY = { gold: 4, levels: [8, 9], chests: 2 };
const REINFORCEMENT_PLUS = { blue: 3, purple: 4 };
const FAST_PROMOTION = 1;
export const VALORS_EMBRACE = 0.08;
export const FORTIFIED_DEFENSE = 1400;
const VANGUARD_LEADER = { atk: 0.25, hurt: 2 };
export const ROGUE_MERCENARY = { cost: 4, damage: 0.25, hp: 1000 };
const FORBIDDEN_POWER = { hp: 0.1, damage: 0.3 };
const LEGACY_OF_VALOR = 2;
const ADEQUATE_STOCK = { blue: 2, purple: 1 };
const TRUST_FUND = [
  { level: 8, gold: 8 },
  { level: 9, gold: 16 },
  { level: 10, gold: 25 },
];
export const ASTRAL_JUDGEMENT = { atk: 1.6, cooldown: 3 };
export const CRUSHING_CLAW = { damage: 0.25, def: 20 };
export const EMERGENCY_RIFT = { souls: 25, round: roundAt(3, 5) };
export const EXCLUSIVE_OFFERING = { extra: 1, share: 0.8 };
const NEON_ZENITH = [
  { level: 8, unit: 'gourd' },
  { level: 9, unit: 'alice' },
];
const TRANSMUTATION = 4;
// Trait perks: one trait's heroes (orbs count) get a combat effect. Tune here.
export const KO_PUNCH = { chance: 0.2, seconds: 1.5 }; // Fighters: basic attacks may stun, no cooldown
export const AFTERSHOCK = { every: 0.3, share: 0.1 }; // Defenders: per share of max hp lost, magic damage around of its max hp
export const BLAZING_VALOR = { perSecond: 0.03, seconds: 5, bonus: 0.08 }; // Dauntless: while shielded, each second; at the cap, a bonus
export const WHIRL_OF_CARNAGE = { atk: 1.3 }; // Weapon Masters: on each cast, physical damage around of attack
export const HAIL_OF_SHOTS = { speed: 0.5, seconds: 10 }; // Deadeyes: attack speed at the start, down to none over the time
export const STAR_CHORUS = { ap: 0.65, targets: 2 }; // Stargazers: on each cast, magic damage to random enemies of magic attack
export const CUTTHROAT = { every: 4, adaptive: 1.8 }; // Hunters: every few seconds the next basic attack adds adaptive damage
export const CRITICAL_SPELLCRAFT = { chance: 0.6, mult: 1.5 }; // Mages: skill damage may crit
export type Perk = 'koPunch' | 'aftershock' | 'blazingValor' | 'whirlOfCarnage' | 'hailOfShots' | 'starChorus' | 'cutthroat' | 'criticalSpellcraft';
// The trait each perk is for.
export const PERKS: Record<Perk, string> = {
  koPunch: 'fighter',
  aftershock: 'defender',
  blazingValor: 'dauntless',
  whirlOfCarnage: 'weaponmaster',
  hailOfShots: 'deadeye',
  starChorus: 'stargazer',
  cutthroat: 'hunter',
  criticalSpellcraft: 'mage',
};
// Gold cards.
export const ITEM_BUNDLE_GOLD = 10; // The Hunt, Holy Objects, Fortified: gold on top of their equipment
const THE_HUNT = ['goldenstaff', 'demonhuntersword', 'seahalberd'];
const HOLY_OBJECTS = ['spellbladetalisman', 'glowingwand', 'icequeenwand'];
const FORTIFIED = ['dominanceice', 'bladearmor', 'guardianhelmet'];
export const TERRITORY_AGREEMENT = { gold: 55, cap: 7 };
export const PARTYS_OPENING = { heroes: 1, gold: 3 };
export const SHARP_ARMORY = { pct: 0.1, max: 8 }; // per basic attack, of its starting attack and magic attack
export const OPENING_PROMOTION = { gold: 2 };
export const VAULT_UPGRADE = { interest: 8, gold: 18 };
export const GOLDEN_ERA = { now: 10, perLevel: 5 };
export const MORE_THE_MERRIER = 1; // gold per active synergy, after each fight
export const DEATH_ORACLE = { shield: 35, refreshes: 35, hp: 1 };
export const COPYCAT = { gold: 6, duplicators: 1 };
export const GLORIOUS_CLAIM = { store: 4, full: 8 };
export const EXPERIENCED_SHUFFLE = { xp: 25, refreshXp: 2 };
export const TURRET_OF_GUARDIANS = { turrets: 2, starRounds: 7 }; // each stars up every starRounds rounds, to 3★
// Disco Fever: every `every` seconds from the start, `dancers` random enemies dance (can't act) for `seconds`;
// your `stars` strongest heroes (highest star, then cost) have `atk` more attack and magic attack.
export const DISCO_FEVER = { every: 6, dancers: 2, seconds: 2, stars: 2, atk: 0.35 };
// Synergy Constellation: attack and magic attack per active synergy; at `at` synergies, `bonus` more on top.
export const SYNERGY_CONSTELLATION = { per: 0.025, at: 10, bonus: 0.5 };
export const DIVINE_EXECUTION = { below: 0.15, splash: 550 }; // splash: true damage to enemies on the tiles around the executed
// Shield of Fortune: gold now and a commander shield; after `rounds`, what's left of that shield turns to gold 1:1.
export const SHIELD_OF_FORTUNE = { slow: { gold: 10, shield: 30, rounds: 5 }, fast: { gold: 15, shield: 30, rounds: 2 } };
const itemList = (ids: string[]) => ids.map((id) => `<b>${ITEMS[id].name}</b>`).join(', ').replace(/, ([^,]*)$/, ' and $1');

// Badges: a trait's orb and one random 2-cost hero of that trait, outside the pool (two badges may give the same hero).
export const BADGE_TRAITS = ['astral', 'gustiwana', 'skybringer', 'fighter', 'dauntless', 'defender', 'deadeye', 'necromancer', 'mage', 'hunter', 'stargazer', 'dragonaltar', 'cultoffire', 'spectre', 'weaponmaster'];
const BADGE_COST = 2;
// Blessings (the badges' gold version): the same orb and hero, plus this trait's item, or an Equipment Chest (null).
export const BLESSING_ITEMS: Record<string, string | null> = {
  weaponmaster: 'waraxe',
  necromancer: null,
  fighter: 'goldenstaff',
  dauntless: 'antiquecuirass',
  defender: 'ancientwrath',
  hunter: 'wintercrown',
  mage: 'spellbladetalisman',
  deadeye: 'berserkerfury',
  stargazer: 'icequeenwand',
  dragonaltar: null,
  cultoffire: null,
  spectre: null,
  astral: null,
  gustiwana: null,
  skybringer: null,
};
export const badgeHeroes = (trait: string) => UNITS.filter((u) => u.tier === BADGE_COST && u.shop !== false && !u.locked && !u.piece && u.traits.includes(trait)).map((u) => u.id);

// Hero cards: a 3★ hero with a permanent buff. Outside the pool: it takes no copies and selling it returns none.
export const SIGNATURE = { atk: 0.35, hp: 0.35 };
const HERO_CARDS: [id: string, name: string, icon: string, hero: string][] = [
  ['quakingBlow', 'Quaking Blow', '🔨', 'minos'],
  ['cycloneSigil', 'Cyclone Sigil', '🌬️', 'val'],
  ['backlineBreach', 'Backline Breach', '🐾', 'siyunyin'],
  ['demonicWrath', 'Demonic Wrath', '😈', 'phove'],
  ['forkedLightning', 'Forked Lightning', '⚡', 'eudora'],
  ['virtuoso', 'Virtuoso', '🎻', 'cici'],
  ['abyssalSmash', 'Abyssal Smash', '🌊', 'dyroth'],
  ['vengefulAegis', 'Vengeful Aegis', '🧿', 'uranus'],
];
const PAYDAY = { blue: { gold: 6, rounds: 1 }, purple: { gold: 7, rounds: 2 }, gold: { gold: 8, rounds: 3 } };

export const POWER_CARDS: Record<string, PowerCardDef> = {
  magicSurge: {
    id: 'magicSurge',
    name: 'Magic Immersion',
    icon: '🌀',
    attackMana: MAGIC_SURGE,
    desc: (t) => `Heroes holding equipment gain <b>${MAGIC_SURGE[t]}</b> bonus mana with every attack.`,
  },
  breathOfTheWild: {
    id: 'breathOfTheWild',
    name: 'Breath of Berserk',
    icon: '🍃',
    hybridLifesteal: BREATH_OF_THE_WILD,
    desc: (t) => `All your heroes gain <b>${BREATH_OF_THE_WILD[t] * 100}%</b> hybrid lifesteal (basic attacks and skills).`,
  },
  premiumClient: {
    id: 'premiumClient',
    name: 'Premium Client',
    icon: '💎',
    freeRefreshChance: PREMIUM_CLIENT,
    desc: (t) => `Each time you refresh the shop yourself, <b>${PREMIUM_CLIENT[t] * 100}%</b> chance to gain a free shop refresh.`,
  },
  payday: {
    id: 'payday',
    name: 'Payday',
    icon: '💰',
    payday: PAYDAY,
    desc: (t) =>
      `Gain <b>${PAYDAY[t].gold}</b> gold now, and <b>${PAYDAY[t].gold}</b> more at the end of each of the next <b>${PAYDAY[t].rounds}</b> round${PAYDAY[t].rounds > 1 ? 's' : ''}.`,
  },
  fastGrowth: {
    id: 'fastGrowth',
    name: 'Full Throttle',
    icon: '🌱',
    xpCut: FAST_GROWTH,
    pickXp: FAST_GROWTH_XP,
    desc: (t) =>
      `XP needed to level up is reduced by <b>${FAST_GROWTH[t] * 100}%</b>.` + (t === 'gold' ? ` Gain <b>${FAST_GROWTH_XP.gold}</b> XP now.` : ''),
  },
  berserk: {
    id: 'berserk',
    name: 'Rising Fury',
    icon: '😤',
    berserk: BERSERK,
    desc: (t) =>
      `All your heroes gain <b>${BERSERK[t] * 100}%</b> hybrid attack every second they survive in a fight, for up to ${BERSERK_SECONDS}s (<b>${Math.round(BERSERK[t] * BERSERK_SECONDS * 100)}%</b>).`,
  },
  kamikaze: {
    id: 'kamikaze',
    name: 'Meltdown Armor',
    icon: '💥',
    kamikaze: KAMIKAZE,
    desc: (t) => `When one of your heroes dies, it explodes: enemies on the tiles around it take <b>${KAMIKAZE[t] * 100}%</b> of its max hp as magic damage.`,
  },
  sharpshooter: {
    id: 'sharpshooter',
    name: 'Dimensional Shoot',
    icon: '🎯',
    sharpshooter: SHARPSHOOTER,
    desc: (t) => `Your heroes deal <b>${SHARPSHOOTER[t] * 100}%</b> bonus damage for every tile between them and their target.`,
  },
  feelingLucky: {
    id: 'feelingLucky',
    name: 'Uncertain Fortune',
    icon: '🎲',
    lucky: FEELING_LUCKY,
    desc: (t) => `Gain gold now: 50% chance of <b>${FEELING_LUCKY[t][0]}</b>, 50% chance of <b>${FEELING_LUCKY[t][1]}</b>.`,
  },
  healingFountain: {
    id: 'healingFountain',
    name: 'Healing Fountain',
    icon: '⛲',
    pickGold: HEALING_FOUNTAIN,
    roundHeal: HEALING_FOUNTAIN_HEAL,
    desc: (t) => `Gain <b>${HEALING_FOUNTAIN[t]}</b> gold now. Your commander heals <b>${HEALING_FOUNTAIN_HEAL[t]}</b> HP at the start of every round.`,
  },
  paladin: {
    id: 'paladin',
    name: 'Rock Solid',
    icon: '🛡️',
    pickShield: PALADIN,
    desc: (t) => `Your commander gains a <b>${PALADIN[t]}</b> shield. It takes the damage from lost fights before your HP does.`,
  },
  shoppingSpree: {
    id: 'shoppingSpree',
    name: 'Glittering Jewels',
    icon: '🛍️',
    pickRerolls: SHOPPING_SPREE,
    desc: (t) => `Gain <b>${SHOPPING_SPREE[t]}</b> free shop refreshes. They keep until used.`,
  },
  solidFront: {
    id: 'solidFront',
    name: 'Solid Front',
    icon: '🧱',
    frontDef: SOLID_FRONT,
    desc: (t) => `Your heroes on the front row gain <b>${SOLID_FRONT[t]}</b> armor and magic resist.`,
  },
  frontierBlitz: {
    id: 'frontierBlitz',
    name: 'Frontier Blitz',
    icon: '↔️',
    edgeAtk: FRONTIER_BLITZ,
    desc: (t) => `Your heroes on the leftmost and rightmost columns (every row) gain <b>${FRONTIER_BLITZ[t] * 100}%</b> hybrid attack.`,
  },
  barriersSeal: {
    id: 'barriersSeal',
    name: "Barrier's Seal",
    icon: '🔰',
    frontHp: BARRIERS_SEAL,
    desc: (t) => `Your heroes on the front row gain <b>${BARRIERS_SEAL[t]}</b> max HP.`,
  },
  manaSovereign: {
    id: 'manaSovereign',
    name: 'Mana Sovereign',
    icon: '🔷',
    backMana: MANA_SOVEREIGN,
    desc: (t) => `Your heroes on the back row start every fight with <b>${MANA_SOVEREIGN[t] * 100}%</b> of their mana.`,
  },
  angelsBlessing: {
    id: 'angelsBlessing',
    name: 'Ethereal Essence',
    icon: '👼',
    skillAmp: ANGELS_BLESSING.amp,
    castRefund: ANGELS_BLESSING.refund,
    desc: (t) =>
      `All your heroes deal <b>${ANGELS_BLESSING.amp[t] * 100}%</b> more skill damage, and get <b>${ANGELS_BLESSING.refund[t] * 100}%</b> of their mana back after casting a skill.`,
  },
  sturdyWarrior: {
    id: 'sturdyWarrior',
    name: 'All-Around Warrior',
    icon: '💪',
    allRound: ALL_ROUND_WARRIOR,
    desc: (t) =>
      `All your heroes gain <b>${ALL_ROUND_WARRIOR[t].hp}</b> max HP, <b>${ALL_ROUND_WARRIOR[t].def}</b> armor and magic resist, and <b>${ALL_ROUND_WARRIOR[t].atk * 100}%</b> hybrid attack.`,
  },
  eliteTeam: {
    id: 'eliteTeam',
    name: 'Elite Team',
    icon: '🏃',
    tiers: ['purple'],
    costAtkSpeed: { purple: ELITE_TEAM },
    desc: () => `Your heroes costing less than <b>${ELITE_TEAM.below}</b> gold gain <b>${ELITE_TEAM.speed * 100}%</b> attack speed.`,
  },
  peerlessValor: {
    id: 'peerlessValor',
    name: 'Peerless Valor',
    icon: '👑',
    tiers: ['purple'],
    costAtkSpeed: { purple: PEERLESS_VALOR },
    desc: () => `Your heroes costing <b>${PEERLESS_VALOR.atLeast}</b> gold or more gain <b>${PEERLESS_VALOR.speed * 100}%</b> attack speed.`,
  },
  pasDeDeux: {
    id: 'pasDeDeux',
    name: 'Pas de Deux',
    icon: '👯',
    tiers: ['purple'],
    twins: { purple: PAS_DE_DEUX },
    starGift: { purple: true },
    desc: () =>
      `Two copies of the same hero on the board: both gain <b>${PAS_DE_DEUX.atk * 100}%</b> hybrid attack and <b>${PAS_DE_DEUX.hp * 100}%</b> max HP. ` +
      'When a hero reaches 3★, gain a 2★ copy of it, even if none are left in the pool.',
  },
  fullyLoaded: {
    id: 'fullyLoaded',
    name: 'Fully Loaded',
    icon: '🎒',
    loaded: FULLY_LOADED,
    desc: (t) => `Your heroes holding ${MAX_ITEMS_PER_UNIT} equipment deal <b>${FULLY_LOADED[t] * 100}%</b> more damage.`,
  },
  teamwork: {
    id: 'teamwork',
    name: 'Purest Power',
    icon: '🤝',
    teamwork: TEAMWORK,
    desc: (t) => `Your heroes in a synergy of ${TEAMWORK_COUNT} or more gain <b>${TEAMWORK[t] * 100}%</b> hybrid attack.`,
  },
  excellentRecruit: {
    id: 'excellentRecruit',
    name: 'Excellent Recruit',
    icon: '🎖️',
    tiers: ['blue', 'purple'],
    recruits: EXCELLENT_RECRUIT,
    desc: (t) => {
      const r = EXCELLENT_RECRUIT[t as 'blue' | 'purple'];
      return `Gain <b>${r.count}</b> random <b>${r.cost}</b>-cost heroes from the pool. With a full bench they go on the board.`;
    },
  },
  cyclicalSupport: {
    id: 'cyclicalSupport',
    name: 'Cyclical Support',
    icon: '🎁',
    chestEvery: CYCLICAL_SUPPORT,
    desc: (t) => `Gain an Equipment Chest now, and another every <b>${CYCLICAL_SUPPORT[t]}</b> rounds.`,
  },
  jumpTheGun: {
    id: 'jumpTheGun',
    name: 'Jump the Gun',
    icon: '⏩',
    pickXp: JUMP_THE_GUN,
    desc: (t) => `Instantly gain <b>${JUMP_THE_GUN[t]}</b> XP.`,
  },
  darkBlade: {
    id: 'darkBlade',
    name: 'Dark Blade',
    icon: '🗡️',
    antiHeal: DARK_BLADE,
    desc: (t) => `Damage from all your heroes cuts the target's healing by <b>${DARK_BLADE[t] * 100}%</b> for ${DARK_BLADE_SECONDS}s.`,
  },
  roguesAid: {
    id: 'roguesAid',
    name: "Rogue's Aid",
    icon: '🗝️',
    tiers: ['blue'],
    pickItem: ROGUES_AID,
    desc: () => 'Gain a <b>Thief Tool</b>.',
  },
  customizeRecruitment: {
    id: 'customizeRecruitment',
    name: 'Customize Recruitment',
    icon: '📋',
    tiers: ['blue', 'purple'],
    shopOdds: CUSTOMIZE_RECRUITMENT,
    desc: (t) => {
      const o = CUSTOMIZE_RECRUITMENT[t as 'blue' | 'purple'];
      return `Your shop's chance of <b>${o.up}</b>-cost heroes is <b>${CUSTOM_UP}%</b> higher, and of <b>${o.down.join(' & ')}</b>-cost heroes <b>${CUSTOM_DOWN}%</b> lower (only at levels where ${o.up}-costs already show up).`;
    },
  },
  fatefulDice: {
    id: 'fatefulDice',
    name: 'Fateful Dice',
    icon: '👥',
    tiers: ['purple'],
    pickMirrors: FATEFUL_DICE,
    desc: () => `Gain <b>${FATEFUL_DICE.purple}</b> Mirror Device: use it any time to copy one of your units.`,
  },
  counterAction: {
    id: 'counterAction',
    name: 'Counter Action',
    icon: '🔄',
    tiers: ['purple'],
    chestTriggers: { purple: [{ hpBelow: COUNTER_ACTION.hp, chests: COUNTER_ACTION.chests }] },
    desc: () => `When your commander's HP drops below <b>${COUNTER_ACTION.hp}</b>, gain <b>${COUNTER_ACTION.chests}</b> Equipment Chests.`,
  },
  apexWeaponry: {
    id: 'apexWeaponry',
    name: 'Apex Weaponry',
    icon: '⚔️',
    tiers: ['purple'],
    pickGold: { blue: 0, purple: APEX_WEAPONRY.gold, gold: 0 },
    chestTriggers: { purple: APEX_WEAPONRY.levels.map((level) => ({ level, chests: APEX_WEAPONRY.chests })) },
    desc: () =>
      `Gain <b>${APEX_WEAPONRY.gold}</b> gold now. Gain <b>${APEX_WEAPONRY.chests}</b> Equipment Chests on reaching level ${APEX_WEAPONRY.levels.join(', and again at level ')}.`,
  },
  reinforcementPlus: {
    id: 'reinforcementPlus',
    name: 'Reinforcement Plus',
    icon: '⭐',
    tiers: ['blue', 'purple'],
    twoStarRecruit: REINFORCEMENT_PLUS,
    desc: (t) => `Gain a random <b>2★ ${REINFORCEMENT_PLUS[t as 'blue' | 'purple']}</b>-cost hero. With a full bench it goes on the board.`,
  },
  fastPromotion: {
    id: 'fastPromotion',
    name: 'Fast Promotion',
    icon: '⏫',
    tiers: ['purple'],
    promoteNext: { purple: FAST_PROMOTION },
    desc: () => 'The next hero you buy comes <b>2★</b> straight away, even if there are not enough copies left in the pool.',
  },
  valorsEmbrace: {
    id: 'valorsEmbrace',
    name: "Valor's Embrace",
    icon: '🐉',
    tiers: ['purple'],
    dragonShield: { purple: VALORS_EMBRACE },
    desc: () => `When one of your heroes dies, your Dragon Altar heroes gain a shield of <b>${VALORS_EMBRACE * 100}%</b> of its max HP.`,
  },
  fortifiedDefense: {
    id: 'fortifiedDefense',
    name: 'Fortified Defense',
    icon: '🏰',
    tiers: ['purple'],
    fortify: { purple: FORTIFIED_DEFENSE },
    desc: () =>
      `When a fight starts, each of your heroes holding ${MAX_ITEMS_PER_UNIT} equipment gives itself and the allies on its left and right a <b>${FORTIFIED_DEFENSE}</b> shield.`,
  },
  vanguardLeader: {
    id: 'vanguardLeader',
    name: 'Vanguard Leader',
    icon: '🚩',
    tiers: ['purple'],
    allAtk: { purple: VANGUARD_LEADER.atk },
    hurtExtra: { purple: VANGUARD_LEADER.hurt },
    desc: () =>
      `All your heroes gain <b>${VANGUARD_LEADER.atk * 100}%</b> hybrid attack, but your commander takes <b>${VANGUARD_LEADER.hurt}</b> more damage from each lost fight.`,
  },
  rogueMercenary: {
    id: 'rogueMercenary',
    name: 'Rogue Mercenary',
    icon: '💼',
    tiers: ['purple'],
    mercenary: { purple: ROGUE_MERCENARY },
    desc: () =>
      `Gain a random <b>${ROGUE_MERCENARY.cost}</b>-cost hero. It permanently deals <b>${ROGUE_MERCENARY.damage * 100}%</b> more damage and has <b>${ROGUE_MERCENARY.hp}</b> more max HP.`,
  },
  forbiddenPower: {
    id: 'forbiddenPower',
    name: 'Forbidden Power',
    icon: '☠️',
    tiers: ['purple'],
    backRisk: { purple: FORBIDDEN_POWER },
    desc: () => `Your heroes on the back row lose <b>${FORBIDDEN_POWER.hp * 100}%</b> max HP but deal <b>${FORBIDDEN_POWER.damage * 100}%</b> more damage.`,
  },
  legacyOfValor: {
    id: 'legacyOfValor',
    name: 'Legacy of Valor',
    icon: '📜',
    tiers: ['purple'],
    legacy: { purple: LEGACY_OF_VALOR },
    desc: () => `Gain a random faction orb and <b>${LEGACY_OF_VALOR}</b> random heroes of that faction, of costs your shop can offer at your level.`,
  },
  adequateStock: {
    id: 'adequateStock',
    name: 'Adequate Stock',
    icon: '📦',
    tiers: ['blue', 'purple'],
    refreshEvery: ADEQUATE_STOCK,
    desc: (t) =>
      ADEQUATE_STOCK[t as 'blue' | 'purple'] === 1
        ? 'Gain a free shop refresh every round. Unused ones are kept.'
        : `Gain a free shop refresh every <b>${ADEQUATE_STOCK[t as 'blue' | 'purple']}</b> rounds. Unused ones are kept.`,
  },
  trustFund: {
    id: 'trustFund',
    name: 'Trust Fund',
    icon: '🏦',
    tiers: ['purple'],
    chestTriggers: { purple: TRUST_FUND.map(({ level, gold }) => ({ level, gold })) },
    desc: () => `Gain ${TRUST_FUND.map(({ level, gold }) => `<b>${gold}</b> gold on reaching level ${level}`).join(', ')}.`,
  },
  astralJudgement: {
    id: 'astralJudgement',
    name: 'Astral Judgement',
    icon: '🌠',
    tiers: ['purple'],
    judgement: { purple: true },
    desc: () =>
      `When your Astral Sovereign's skill hits enemies, a Judgement Bolt strikes each of them for <b>${ASTRAL_JUDGEMENT.atk * 100}%</b> of its hybrid attack as pure damage (once every ${ASTRAL_JUDGEMENT.cooldown}s).`,
  },
  crushingClaw: {
    id: 'crushingClaw',
    name: 'Crushing Claw',
    icon: '🦅',
    tiers: ['purple'],
    crushingClaw: { purple: true },
    desc: () =>
      `Your Skybringer lightning deals <b>${CRUSHING_CLAW.damage * 100}%</b> more damage as pure damage, and lowers the armor and magic resist of the enemies it hits by <b>${CRUSHING_CLAW.def}</b>.`,
  },
  emergencyRift: {
    id: 'emergencyRift',
    name: 'Emergency Rift',
    icon: '🕳️',
    tiers: ['purple'],
    rift: { purple: { souls: EMERGENCY_RIFT.souls } },
    desc: () =>
      `Gain <b>${EMERGENCY_RIFT.souls}</b> Necromancer souls now, and a second Plane Wanderer (a different one from your grave's). ` +
      `It becomes <b>2★</b> on ${roundLabel(EMERGENCY_RIFT.round)} and stays 2★ for the rest of the game.`,
  },
  exclusiveOffering: {
    id: 'exclusiveOffering',
    name: 'Exclusive Offering',
    icon: '🔥',
    tiers: ['purple'],
    offerings: { purple: EXCLUSIVE_OFFERING },
    enhances: { purple: ['offering'] },
    desc: () =>
      `While Cult of Fire is active, gain <b>${EXCLUSIVE_OFFERING.extra}</b> more Pyre Offering. Each Offering gives the cult ` +
      `<b>${EXCLUSIVE_OFFERING.share * 100}%</b> of its bearer's attack (its bearer still gets none). Your Pyre Offerings are <b>enhanced</b>.`,
  },
  gustiwanaUnbound: {
    id: 'gustiwanaUnbound',
    name: 'Gustiwana Unbound',
    icon: '🔓',
    tiers: ['purple'],
    enhances: { purple: GUSTIWANA_UNBOUND.items },
    pickRefreshes: { purple: GUSTIWANA_UNBOUND.refreshes },
    desc: () =>
      `Your Gustiwana items (${GUSTIWANA_UNBOUND.items.map((i) => ITEMS[i].name).join(', ')}) are <b>enhanced</b>, now and from now on. ` +
      `Gain <b>${GUSTIWANA_UNBOUND.refreshes}</b> free shop refreshes.`,
  },
  ...Object.fromEntries(
    ENHANCING_CARDS.map(({ id, name, icon, item }) => [
      id,
      {
        id,
        name,
        icon,
        tiers: ['purple'],
        pickItem: { purple: item },
        enhances: { purple: [item] },
        desc: () => `Gain an <b>Enhanced ${ITEMS[item].name}</b>. Every ${ITEMS[item].name} you have or get is <b>enhanced</b>.`,
      } satisfies PowerCardDef,
    ]),
  ),
  neonZenith: {
    id: 'neonZenith',
    name: 'Neon Zenith',
    icon: '🌃',
    tiers: ['purple'],
    chestTriggers: { purple: NEON_ZENITH.map(({ level, unit }) => ({ level, unit })) },
    desc: () => `Gain ${NEON_ZENITH.map(({ level, unit }) => `<b>${UNIT_BY_ID[unit].name}</b> on reaching level ${level}`).join(' and ')}.`,
  },
  transmutation: {
    id: 'transmutation',
    name: 'Transmutation',
    icon: '⚗️',
    tiers: ['purple'],
    transmute: { purple: TRANSMUTATION },
    desc: () => `After <b>${TRANSMUTATION}</b> rounds, this card turns into a random <b>gold</b> power card.`,
  },
  koPunch: {
    id: 'koPunch',
    name: 'KO Punch',
    icon: '🥊',
    tiers: ['purple'],
    perk: { purple: 'koPunch' },
    desc: () => `Your Fighters' basic attacks have a <b>${KO_PUNCH.chance * 100}%</b> chance to stun the target for <b>${KO_PUNCH.seconds}s</b>.`,
  },
  aftershock: {
    id: 'aftershock',
    name: 'Aftershock',
    icon: '🌋',
    tiers: ['purple'],
    perk: { purple: 'aftershock' },
    desc: () =>
      `For every <b>${AFTERSHOCK.every * 100}%</b> of its HP a Defender loses, it deals <b>${AFTERSHOCK.share * 100}%</b> of its max HP as magic damage to the enemies on the tiles around it.`,
  },
  blazingValor: {
    id: 'blazingValor',
    name: 'Blazing Valor',
    icon: '🔆',
    tiers: ['purple'],
    perk: { purple: 'blazingValor' },
    desc: () =>
      `While shielded, your Dauntless heroes gain <b>${BLAZING_VALOR.perSecond * 100}%</b> max HP and hybrid attack every second. ` +
      `After ${BLAZING_VALOR.seconds}s it stops, and they gain <b>${BLAZING_VALOR.bonus * 100}%</b> more (<b>${Math.round((BLAZING_VALOR.perSecond * BLAZING_VALOR.seconds + BLAZING_VALOR.bonus) * 100)}%</b> in all).`,
  },
  whirlOfCarnage: {
    id: 'whirlOfCarnage',
    name: 'Whirl of Carnage',
    icon: '🌪️',
    tiers: ['purple'],
    perk: { purple: 'whirlOfCarnage' },
    desc: () => `Whenever a Weapon Master casts its skill, it deals <b>${WHIRL_OF_CARNAGE.atk * 100}%</b> of its attack as physical damage to the enemies on the tiles around it.`,
  },
  hailOfShots: {
    id: 'hailOfShots',
    name: 'Hail of Shots',
    icon: '🏹',
    tiers: ['purple'],
    perk: { purple: 'hailOfShots' },
    desc: () => `Your Deadeyes start every fight with <b>${HAIL_OF_SHOTS.speed * 100}%</b> attack speed, fading to none over ${HAIL_OF_SHOTS.seconds}s.`,
  },
  starChorus: {
    id: 'starChorus',
    name: 'Star Chorus',
    icon: '🎶',
    tiers: ['purple'],
    perk: { purple: 'starChorus' },
    desc: () => `Whenever a Stargazer casts its skill, it deals <b>${STAR_CHORUS.ap * 100}%</b> of its magic attack as magic damage to <b>${STAR_CHORUS.targets}</b> random enemies.`,
  },
  cutthroat: {
    id: 'cutthroat',
    name: 'Cutthroat',
    icon: '🔪',
    tiers: ['purple'],
    perk: { purple: 'cutthroat' },
    desc: () =>
      `Every <b>${CUTTHROAT.every}s</b>, a Hunter's next basic attack is enhanced: it deals an extra <b>${CUTTHROAT.adaptive * 100}%</b> of its higher of attack and magic attack as adaptive damage.`,
  },
  criticalSpellcraft: {
    id: 'criticalSpellcraft',
    name: 'Critical Spellcraft',
    icon: '✨',
    tiers: ['purple'],
    perk: { purple: 'criticalSpellcraft' },
    desc: () => `Your Mages' skill damage has a <b>${CRITICAL_SPELLCRAFT.chance * 100}%</b> chance to deal <b>${CRITICAL_SPELLCRAFT.mult * 100}%</b> damage.`,
  },
  factionSynergy: {
    id: 'factionSynergy',
    name: 'Prime Selection',
    icon: '🔵',
    tiers: ['blue'],
    factionOrbChoices: { blue: PRIME_SELECTION, purple: PRIME_SELECTION, gold: PRIME_SELECTION },
    desc: () =>
      `Choose an orb out of <b>${PRIME_SELECTION}</b> random factions and roles (any mix): put it on a hero for +1 to that faction or role.`,
  },
  allysCall: {
    id: 'allysCall',
    name: "Ally's Call",
    icon: '📯',
    tiers: ['gold'],
    allyCall: { gold: true },
    desc: () => 'Whenever a hero stars up, gain a <b>1★ hero</b> that shares one of its factions or roles (picked at random), of a cost your shop can roll.',
  },
  theHunt: {
    id: 'theHunt',
    name: 'The Hunt',
    icon: '🦌',
    tiers: ['gold'],
    pickItems: { gold: THE_HUNT },
    pickGold: { gold: ITEM_BUNDLE_GOLD },
    desc: () => `Gain ${itemList(THE_HUNT)}, and <b>${ITEM_BUNDLE_GOLD}</b> gold.`,
  },
  holyObjects: {
    id: 'holyObjects',
    name: 'Holy Objects',
    icon: '📿',
    tiers: ['gold'],
    pickItems: { gold: HOLY_OBJECTS },
    pickGold: { gold: ITEM_BUNDLE_GOLD },
    desc: () => `Gain ${itemList(HOLY_OBJECTS)}, and <b>${ITEM_BUNDLE_GOLD}</b> gold.`,
  },
  fortified: {
    id: 'fortified',
    name: 'Fortified',
    icon: '🏰',
    tiers: ['gold'],
    pickItems: { gold: FORTIFIED },
    pickGold: { gold: ITEM_BUNDLE_GOLD },
    desc: () => `Gain ${itemList(FORTIFIED)}, and <b>${ITEM_BUNDLE_GOLD}</b> gold.`,
  },
  fullyArmed: {
    id: 'fullyArmed',
    name: 'Fully Armed',
    icon: '🎒',
    tiers: ['gold'],
    fullyArmed: { gold: true },
    desc: () =>
      'When a fight starts, each of your heroes holding no equipment borrows <b>2 random equipment</b> for that fight: one attack piece (physical or magic, by its basic attack) and one armor piece.',
  },
  territoryAgreement: {
    id: 'territoryAgreement',
    name: 'Territory Agreement',
    icon: '📜',
    tiers: ['gold'],
    pickGold: { gold: TERRITORY_AGREEMENT.gold },
    levelCap: { gold: TERRITORY_AGREEMENT.cap },
    offerIf: (p) => p.level <= TERRITORY_AGREEMENT.cap,
    desc: () => `Gain <b>${TERRITORY_AGREEMENT.gold}</b> gold now, but you can't go past <b>level ${TERRITORY_AGREEMENT.cap}</b> for the rest of the match.`,
  },
  partysOpening: {
    id: 'partysOpening',
    name: "Party's Opening",
    icon: '🎉',
    tiers: ['gold'],
    heroCap: { gold: PARTYS_OPENING.heroes },
    pickGold: { gold: PARTYS_OPENING.gold },
    desc: () => `You can field <b>${PARTYS_OPENING.heroes}</b> more hero. Gain <b>${PARTYS_OPENING.gold}</b> gold.`,
  },
  sharpArmory: {
    id: 'sharpArmory',
    name: 'Sharp Armory',
    icon: '⚒️',
    tiers: ['gold'],
    sharpArmory: { gold: SHARP_ARMORY },
    desc: () =>
      `Your heroes on the back row gain <b>${SHARP_ARMORY.pct * 100}%</b> hybrid attack with each basic attack, up to <b>${SHARP_ARMORY.max}</b> times (${SHARP_ARMORY.pct * SHARP_ARMORY.max * 100}%), for the rest of the fight.`,
  },
  openingPromotion: {
    id: 'openingPromotion',
    name: 'Opening Promotion',
    icon: '🏷️',
    tiers: ['gold'],
    freeBuy: { gold: true },
    pickGold: { gold: OPENING_PROMOTION.gold },
    desc: () => `The first hero you buy each round is <b>free</b>, whatever its cost. Gain <b>${OPENING_PROMOTION.gold}</b> gold now.`,
  },
  vaultUpgrade: {
    id: 'vaultUpgrade',
    name: 'Vault Upgrade',
    icon: '🏦',
    tiers: ['gold'],
    interestCap: { gold: VAULT_UPGRADE.interest },
    pickGold: { gold: VAULT_UPGRADE.gold },
    desc: () =>
      `Interest can reach <b>${VAULT_UPGRADE.interest}</b> gold a round (at ${(VAULT_UPGRADE.interest / INTEREST_PER_10) * 10} gold banked). Gain <b>${VAULT_UPGRADE.gold}</b> gold now.`,
  },
  goldenEra: {
    id: 'goldenEra',
    name: 'Golden Era',
    icon: '🌅',
    tiers: ['gold'],
    pickRefreshes: { gold: GOLDEN_ERA.now },
    levelRefreshes: { gold: GOLDEN_ERA.perLevel },
    desc: () => `Gain <b>${GOLDEN_ERA.now}</b> free shop refreshes now, and <b>${GOLDEN_ERA.perLevel}</b> more each time you level up.`,
  },
  moreTheMerrier: {
    id: 'moreTheMerrier',
    name: 'The More the Merrier',
    icon: '🎊',
    tiers: ['gold'],
    traitGold: { gold: MORE_THE_MERRIER },
    desc: () => `After each fight, gain <b>${MORE_THE_MERRIER}</b> gold for every synergy you had active.`,
  },
  deathOracle: {
    id: 'deathOracle',
    name: 'Death Oracle',
    icon: '💀',
    tiers: ['gold'],
    pickShield: { gold: DEATH_ORACLE.shield },
    bloodRefreshes: { gold: DEATH_ORACLE.refreshes },
    desc: () =>
      `Gain a <b>${DEATH_ORACLE.shield}</b> commander shield. Your next <b>${DEATH_ORACLE.refreshes}</b> shop refreshes cost <b>${DEATH_ORACLE.hp} HP</b> instead of gold (never your last HP).`,
  },
  copycat: {
    id: 'copycat',
    name: 'Copycat',
    icon: '🐈',
    tiers: ['gold'],
    pickGold: { gold: COPYCAT.gold },
    pickDuplicators: { gold: COPYCAT.duplicators },
    desc: () =>
      `Gain <b>${COPYCAT.gold}</b> gold and an <b>Equipment Duplicator</b>: use it on a piece of equipment to make <b>3</b> copies of it (not enhanced, trait or other special items).`,
  },
  novelEquipment: {
    id: 'novelEquipment',
    name: 'Novel Equipment',
    icon: '📖',
    tiers: ['gold'],
    novelItems: { gold: NOVEL_EQUIPMENT },
    desc: () =>
      `Gain <b>${NOVEL_EQUIPMENT}</b> random <b>enhanced</b> equipment, straight to your inventory. Every other copy of them you have or get is <b>enhanced</b> too.`,
  },
  ...Object.fromEntries(
    (['slow', 'fast'] as const).map((speed): [string, PowerCardDef] => {
      const f = SHIELD_OF_FORTUNE[speed];
      const id = speed === 'slow' ? 'shieldOfFortuneSlow' : 'shieldOfFortuneFast';
      return [
        id,
        {
          id,
          name: `Shield of Fortune (${speed === 'slow' ? 'Slow' : 'Fast'})`,
          icon: speed === 'slow' ? '🐢' : '🐇',
          tiers: ['gold'],
          pickGold: { gold: f.gold },
          pickShield: { gold: f.shield },
          fortune: { gold: f.rounds },
          desc: () =>
            `Gain <b>${f.gold}</b> gold and a <b>${f.shield}</b> commander shield now. After <b>${f.rounds}</b> rounds, whatever is left of that shield turns into gold, 1 for 1.`,
        },
      ];
    }),
  ),
  gloriousClaim: {
    id: 'gloriousClaim',
    name: 'Glorious Claim',
    icon: '🏆',
    tiers: ['gold'],
    claim: { gold: GLORIOUS_CLAIM },
    desc: () =>
      `Each win stores <b>${GLORIOUS_CLAIM.store}</b> gold (on top of all other gold). You get the stored gold when you lose a fight, or as soon as it reaches <b>${GLORIOUS_CLAIM.full}</b>.`,
  },
  experiencedShuffle: {
    id: 'experiencedShuffle',
    name: 'Experienced Shuffle',
    icon: '🔀',
    tiers: ['gold'],
    pickXp: { gold: EXPERIENCED_SHUFFLE.xp },
    refreshXp: { gold: EXPERIENCED_SHUFFLE.refreshXp },
    desc: () => `Gain <b>${EXPERIENCED_SHUFFLE.xp}</b> XP now. After that, your first shop refresh each round gives <b>${EXPERIENCED_SHUFFLE.refreshXp}</b> XP.`,
  },
  turretOfGuardians: {
    id: 'turretOfGuardians',
    name: 'Turret of Guardians',
    icon: '🗼',
    tiers: ['gold'],
    turrets: { gold: TURRET_OF_GUARDIANS.turrets },
    desc: () =>
      `Gain <b>${TURRET_OF_GUARDIANS.turrets}</b> Turrets, each with a random faction and a random role. A Turret takes no board slot and can't be sold; it never moves (nor can enemies move it), has a 4-gold hero's stats and a range of 12. ` +
      `They come 1★ and gain a star every <b>${TURRET_OF_GUARDIANS.starRounds}</b> rounds (up to 3★).`,
  },
  divineExecution: {
    id: 'divineExecution',
    name: 'Divine Execution',
    icon: '⚖️',
    tiers: ['gold'],
    execute: { gold: DIVINE_EXECUTION.below },
    desc: () =>
      `Damage from your heroes executes enemies left under <b>${DIVINE_EXECUTION.below * 100}%</b> of their max HP. Each execution deals <b>${DIVINE_EXECUTION.splash}</b> true damage to enemies on the tiles around the executed one.`,
  },
  discoFever: {
    id: 'discoFever',
    name: 'Disco Fever',
    icon: '🕺',
    tiers: ['gold'],
    disco: { gold: true },
    desc: () =>
      `In fights, every <b>${DISCO_FEVER.every}s</b> (starting right away), <b>${DISCO_FEVER.dancers}</b> random enemies dance for <b>${DISCO_FEVER.seconds}s</b>, unable to act. ` +
      `Your <b>${DISCO_FEVER.stars}</b> strongest heroes gain <b>${DISCO_FEVER.atk * 100}%</b> hybrid attack.`,
  },
  synergyConstellation: {
    id: 'synergyConstellation',
    name: 'Synergy Constellation',
    icon: '🌠',
    tiers: ['gold'],
    constellation: { gold: true },
    desc: () =>
      `Your heroes gain <b>${SYNERGY_CONSTELLATION.per * 100}%</b> hybrid attack for every active synergy. With <b>${SYNERGY_CONSTELLATION.at}</b> or more active, they gain <b>${SYNERGY_CONSTELLATION.bonus * 100}%</b> more on top.`,
  },
  // Badges.
  ...Object.fromEntries(
    BADGE_TRAITS.map((trait): [string, PowerCardDef] => {
      const id = `${trait}Badge`;
      return [
        id,
        {
          id,
          name: `${TRAITS[trait].name} Badge`,
          icon: TRAITS[trait].icon,
          tiers: ['purple'],
          badge: { purple: trait },
          desc: () =>
            `Gain a <b>${TRAITS[trait].name} orb</b> (put it on a hero for +1 ${TRAITS[trait].name}) and a random 2-gold ${TRAITS[trait].name} hero: ${badgeHeroes(trait).map((h) => UNIT_BY_ID[h].name).join(' or ')}.`,
        },
      ];
    }),
  ),
  // Blessings: the badges' gold version, with an item (or a chest) on top.
  ...Object.fromEntries(
    BADGE_TRAITS.map((trait): [string, PowerCardDef] => {
      const id = `${trait}Blessing`;
      const item = BLESSING_ITEMS[trait];
      const name = TRAITS[trait].name;
      return [
        id,
        {
          id,
          name: `${name} Blessing`,
          icon: TRAITS[trait].icon,
          tiers: ['gold'],
          badge: { gold: trait },
          ...(item ? { pickItem: { gold: item } } : { pickChests: { gold: 1 } }),
          desc: () =>
            `Gain a <b>${name} orb</b> (put it on a hero for +1 ${name}), a random 2-gold ${name} hero (${badgeHeroes(trait).map((h) => UNIT_BY_ID[h].name).join(' or ')}), ` +
            (item ? `and a <b>${ITEMS[item].name}</b>.` : 'and an <b>Equipment Chest</b>.'),
        },
      ];
    }),
  ),
  // Hero cards.
  ...Object.fromEntries(
    HERO_CARDS.map(([id, name, icon, hero]): [string, PowerCardDef] => [
      id,
      {
        id,
        name,
        icon,
        tiers: ['purple'],
        signature: { purple: hero },
        desc: () =>
          `Gain a <b>3★ ${UNIT_BY_ID[hero].name}</b>. It permanently has <b>${SIGNATURE.atk * 100}%</b> more hybrid attack and <b>${SIGNATURE.hp * 100}%</b> more max HP.`,
      },
    ]),
  ),
};

// The tiers a card is offered at.
export const cardTiers = (id: string): readonly PowerTier[] => POWER_CARDS[id].tiers ?? (['blue', 'purple', 'gold'] as const);

// "Payday II"; a card offered at a single tier has no numeral ("Pas de Deux").
export const powerCardName = (id: string, tier: PowerTier) =>
  cardTiers(id).length > 1 ? `${POWER_CARDS[id].name} ${TIER_NUMERAL[tier]}` : POWER_CARDS[id].name;

// The tier on offer this round, if it's a power card round.
export const powerTierAt = (state: GameState, round: number): PowerTier | undefined =>
  state.powerTiers?.[POWER_CARD_ROUNDS.indexOf(round)];

// The power cards that can be offered at `tier`.
// The cards offered at `tier`; with a player, only those their state allows (offerIf) and never one they already
// hold, at any tier: no card twice.
export const powerPool = (tier: PowerTier, p?: Player): string[] =>
  Object.keys(POWER_CARDS).filter(
    (id) =>
      (POWER_CARDS[id].tiers?.includes(tier) ?? true) &&
      (!p || ((POWER_CARDS[id].offerIf?.(p) ?? true) && !(p.powerCards ?? []).some((c) => c.id === id))),
  );

// A power card round's offer. No time limit: it waits until picked, even rounds later, and a game that ends first
// gives nothing. One still waiting when the next round comes queues that round behind it; its cards are drawn
// once the earlier pick is made (so never one already held).
// Zhu Yong raises the round's tier (and pays a treasure for each tier past gold) as it's offered.
export function offerPowerCards(state: GameState, p: Player): void {
  const base = powerTierAt(state, state.round);
  if (!base) return;
  const { tier, from, treasures } = raisedTier(p, base);
  for (let k = 0; k < treasures; k++) openTreasure(state, p);
  const deal: PowerDeal = { tier, round: state.round, ...(from && { from }) };
  if (p.powerOffer) (p.powerQueue ??= []).push(deal);
  else dealPowerOffer(state, p, deal);
}

// A round's deck at a tier: every card of the tier, shuffled once, shared by every player. Offers and rerolls
// draw from the top, so everyone at the tier is shown the same cards in the same order (skipping the ones
// they can't take).
function powerDeck(state: GameState, round: number, tier: PowerTier): string[] {
  return ((state.powerDecks ??= {})[`${round}:${tier}`] ??= shuffle(state, powerPool(tier)));
}

// The next card in the offer's deck this player can take and hasn't been shown in this offer, if any.
function nextPowerCard(state: GameState, p: Player, offer: PowerOffer): string | undefined {
  const seen = offer.seen ?? offer.cards;
  const can = new Set(powerPool(offer.tier, p));
  return powerDeck(state, offer.round ?? state.round, offer.tier).find((id) => can.has(id) && !seen.includes(id));
}

function dealPowerOffer(state: GameState, p: Player, deal: PowerDeal): void {
  const offer: PowerOffer = { ...deal, cards: [], rerolls: 0, seen: [] };
  for (let k = 0; k < CARD_OFFER_SIZE; k++) {
    const id = nextPowerCard(state, p, offer);
    if (!id) break;
    offer.cards.push(id);
    offer.seen!.push(id);
  }
  p.powerOffer = offer;
}

// Whether a reroll has a card left to bring (one not shown in this offer yet).
export const canRerollPower = (state: GameState, p: Player): boolean => !!p.powerOffer && nextPowerCard(state, p, p.powerOffer) !== undefined;

// Swaps one offered power card for the next in the deck. Each slot gets one reroll (shared). A card once
// shown never comes back in this offer.
export function rerollPowerCard(state: GameState, p: Player, slot: number): string | null {
  const offer = p.powerOffer;
  if (!offer?.cards[slot]) return 'No card there';
  if (offer.rerolls >= offer.cards.length) return 'No rerolls left';
  const next = nextPowerCard(state, p, offer);
  if (!next) return 'No other cards left';
  (offer.seen ??= [...offer.cards]).push(next);
  offer.cards[slot] = next;
  offer.rerolls++;
  return null;
}

export function pickPowerCard(state: GameState, p: Player, id: string): string | null {
  if (!p.powerOffer?.cards.includes(id)) return 'That card is not on offer';
  const tier = p.powerOffer.tier;
  p.powerOffer = undefined;
  gainPowerCard(state, p, id, tier);
  const next = p.powerQueue?.shift();
  if (!p.powerQueue?.length) p.powerQueue = undefined;
  if (next) dealPowerOffer(state, p, next);
  return null;
}

// A power card joins the player's, with what it gives on the pick.
function gainPowerCard(state: GameState, p: Player, id: string, tier: PowerTier): void {
  (p.powerCards ??= []).push({ id, tier });
  addXp(p, POWER_CARDS[id].pickXp?.[tier] ?? 0); // Jump the Gun; with none, Full Throttle: already past the new, lower bar
  p.gold += POWER_CARDS[id].pickGold?.[tier] ?? 0;
  const orbChoices = POWER_CARDS[id].factionOrbChoices?.[tier];
  if (orbChoices) {
    // Factions and roles in one pile, so any one of them is less likely to come up.
    const factions = shuffle(state, orbTraits()).slice(0, orbChoices);
    if (factions.length === 1) giveFactionOrb(state, p, factions[0]);
    else p.factionOrbOffer = factions;
  }
  p.freeRerolls = (p.freeRerolls ?? 0) + (POWER_CARDS[id].pickRerolls?.[tier] ?? 0);
  p.shield = (p.shield ?? 0) + (POWER_CARDS[id].pickShield?.[tier] ?? 0) || undefined;
  const luck = POWER_CARDS[id].lucky?.[tier];
  if (luck) p.gold += nextFloat(state) < 0.5 ? luck[0] : luck[1];
  p.promoteNext = (p.promoteNext ?? 0) + (POWER_CARDS[id].promoteNext?.[tier] ?? 0) || undefined;
  const merc = POWER_CARDS[id].mercenary?.[tier];
  if (merc) {
    const unit = drawFromTier(state, merc.cost);
    if (unit && canClaimToBoard(p, unit)) gainUnit(state, p, unit, true, true);
    else if (unit) state.pool[unit]++;
  }
  for (let k = 0; k < (POWER_CARDS[id].pickChests?.[tier] ?? 0); k++) giveChest(state, p); // Blessings
  const badge = POWER_CARDS[id].badge?.[tier];
  if (badge) {
    giveFactionOrb(state, p, badge);
    // The hero is outside the pool: none taken, none returned when sold.
    const heroes = badgeHeroes(badge);
    const unit = heroes[nextInt(state, heroes.length)];
    if (canClaimToBoard(p, unit)) gainUnit(state, p, unit, true, false, true);
  }
  const legacy = POWER_CARDS[id].legacy?.[tier];
  if (legacy) {
    const factions = orbTraits('faction');
    const trait = factions[nextInt(state, factions.length)];
    giveFactionOrb(state, p, trait);
    for (let i = 0; i < legacy; i++) {
      const odds = shopOdds(p.level, p); // only costs this level's shop rolls
      const open = UNITS.filter((u) => u.shop !== false && !u.locked && !u.piece && u.traits.includes(trait) && odds[u.tier - 1] > 0 && (state.pool[u.id] ?? 0) > 0);
      if (!open.length) break;
      const unit = open[nextInt(state, open.length)].id;
      if (!canClaimToBoard(p, unit)) break;
      state.pool[unit]--;
      gainUnit(state, p, unit, true);
    }
  }
  const star = POWER_CARDS[id].twoStarRecruit?.[tier];
  if (star) {
    const unit = drawFromTier(state, star); // picked as the shop would
    if (unit) {
      state.pool[unit]++; // giveTwoStar takes the copies itself
      giveTwoStar(state, p, unit);
    }
  }
  const recruit = POWER_CARDS[id].recruits?.[tier];
  for (let i = 0; recruit && i < recruit.count; i++) {
    const unit = drawFromTier(state, recruit.cost);
    if (!unit) break; // that cost is drained
    // A full bench sends it to the board, past the level limit if need be (trimmed when the fight starts).
    if (canClaimToBoard(p, unit)) gainUnit(state, p, unit, true);
    else state.pool[unit]++; // no room anywhere: back to the pool
  }
  const item = POWER_CARDS[id].pickItem?.[tier];
  if (item) p.items.push({ uid: state.nextUid++, id: item, tier: 1, holder: null });
  // Novel Equipment: random different equipment, each kept enhanced from now on.
  const novel = POWER_CARDS[id].novelItems?.[tier] ?? 0;
  if (novel) {
    const picks = shuffle(state, EQUIPMENT.filter((e) => !(p.enhancedItems ?? []).includes(e))).slice(0, novel);
    (p.enhancedItems ??= []).push(...picks);
    for (const e of picks) p.items.push({ uid: state.nextUid++, id: e, tier: 1, holder: null });
  }
  enhanceOwned(p); // Manic Slam and co.: the item just given, and any owned already
  const c = POWER_CARDS[id];
  p.freeRerolls = (p.freeRerolls ?? 0) + (c.pickRefreshes?.[tier] ?? 0) || p.freeRerolls; // Golden Era
  if (c.bloodRefreshes?.[tier]) p.bloodRefreshes = (p.bloodRefreshes ?? 0) + c.bloodRefreshes[tier]!;
  if (c.pickDuplicators?.[tier]) p.duplicators = (p.duplicators ?? 0) + c.pickDuplicators[tier]!; // Copycat
  const turrets = c.turrets?.[tier] ?? 0;
  for (let k = 0; k < turrets; k++) {
    const f = JOHNNIE_FACTIONS[nextInt(state, JOHNNIE_FACTIONS.length)];
    const r = JOHNNIE_ROLES[nextInt(state, JOHNNIE_ROLES.length)];
    (p.turrets ??= []).push({ defId: turretId(f, r), from: state.round });
  }
  if (turrets) deliverTurrets(state, p);
  const fortune = c.fortune?.[tier];
  if (fortune) (p.fortunes ??= []).push({ round: state.round + fortune, shield: c.pickShield?.[tier] ?? 0 });
  if (POWER_CARDS[id].freeBuy?.[tier]) p.freeBuy = (p.freeBuy ?? 0) + 1; // Opening Promotion: starting with this round
  for (const more of POWER_CARDS[id].pickItems?.[tier] ?? []) p.items.push({ uid: state.nextUid++, id: more, tier: 1, holder: null });
  const cap = POWER_CARDS[id].levelCap?.[tier];
  if (cap) {
    p.levelCap = Math.min(p.levelCap ?? cap, cap);
    if (p.level >= p.levelCap) p.xp = 0;
  }
  p.mirrors = (p.mirrors ?? 0) + (POWER_CARDS[id].pickMirrors?.[tier] ?? 0) || undefined;
  const triggers = POWER_CARDS[id].chestTriggers?.[tier];
  if (triggers) {
    (p.chestTriggers ??= []).push(...triggers.map((tr) => ({ ...tr })));
    checkChestTriggers(state, p); // already met: now
  }
  const signature = POWER_CARDS[id].signature?.[tier];
  if (signature) {
    (p.signatures ??= []).push(signature);
    deliverSignatures(state, p);
  }
  const rift = POWER_CARDS[id].rift?.[tier];
  if (rift) openRift(state, p, rift.souls);
  const transmute = POWER_CARDS[id].transmute?.[tier];
  if (transmute) (p.transmutes ??= []).push(state.round + transmute);
  const refresh = POWER_CARDS[id].refreshEvery?.[tier];
  if (refresh) (p.refreshCycles ??= []).push({ every: refresh, from: state.round });
  const every = POWER_CARDS[id].chestEvery?.[tier];
  if (every) {
    (p.chestCycles ??= []).push({ every, from: state.round });
    giveChest(state, p);
  }
  const pay = POWER_CARDS[id].payday?.[tier];
  if (pay) {
    p.gold += pay.gold;
    (p.payday ??= []).push({ ...pay });
  }
}

// Magic Immersion: bonus mana per attack for a hero holding equipment (summed over the cards held).
export const attackManaOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].attackMana?.[c.tier] ?? 0), 0);

// Stat mods a fielded hero on board `cell`, holding `held` items and in `bigTraits` synergies of
// TEAMWORK_COUNT or more, gets from the power cards held (Breath of Berserk, Solid Front, Barrier's Seal, Frontier Blitz,
// Ethereal Essence, All-Around Warrior, Fully Loaded, Purest Power, Elite Team, Peerless Valor, Pas de Deux,
// Vanguard Leader, Forbidden Power).
// `defId`, when given, is the hero's (for the cost and copy cards).
export function powerMods(p: Player, cell: number, held: number, bigTraits: number, defId?: string): StatMod[] {
  const sum = (k: 'hybridLifesteal' | 'frontDef' | 'frontHp' | 'edgeAtk' | 'skillAmp' | 'loaded' | 'teamwork' | 'allAtk') => (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id][k]?.[c.tier] ?? 0), 0);
  const mods: StatMod[] = [];
  const steal = sum('hybridLifesteal');
  if (steal) mods.push({ stat: 'lifesteal', add: steal }, { stat: 'spellLifesteal', add: steal });
  const all = sum('allAtk'); // Vanguard Leader
  if (all) mods.push({ stat: 'atk', pct: all }, { stat: 'ap', pct: all });
  for (const c of p.powerCards ?? []) {
    const risk = cell >= BOARD_COLS * (BOARD_ROWS - 1) ? POWER_CARDS[c.id].backRisk?.[c.tier] : undefined; // Forbidden Power
    if (risk) mods.push({ stat: 'hp', pct: -risk.hp }, { stat: 'damageAmp', add: risk.damage });
    const ar = POWER_CARDS[c.id].allRound?.[c.tier];
    if (ar) mods.push({ stat: 'hp', add: ar.hp }, { stat: 'armor', add: ar.def }, { stat: 'mr', add: ar.def }, { stat: 'atk', pct: ar.atk }, { stat: 'ap', pct: ar.atk });
    if (!defId) continue;
    const cost = UNIT_BY_ID[defId].tier;
    const speed = POWER_CARDS[c.id].costAtkSpeed?.[c.tier];
    if (speed && ((speed.below !== undefined && cost < speed.below) || (speed.atLeast !== undefined && cost >= speed.atLeast)))
      mods.push({ stat: 'attackSpeed', add: speed.speed });
    const twins = POWER_CARDS[c.id].twins?.[c.tier];
    if (twins && p.board.filter((u) => u?.defId === defId).length >= 2)
      mods.push({ stat: 'atk', pct: twins.atk }, { stat: 'ap', pct: twins.atk }, { stat: 'hp', pct: twins.hp });
  }
  // Teamwork: once per synergy of the hero's at TEAMWORK_COUNT or more.
  const team = sum('teamwork') * bigTraits;
  if (team) mods.push({ stat: 'atk', pct: team }, { stat: 'ap', pct: team });
  const loaded = held >= MAX_ITEMS_PER_UNIT ? sum('loaded') : 0;
  if (loaded) mods.push({ stat: 'damageAmp', add: loaded });
  const amp = sum('skillAmp');
  if (amp) mods.push({ stat: 'skillAmp', add: amp });
  const def = cell < BOARD_COLS ? sum('frontDef') : 0; // row 0 is the front
  if (def) mods.push({ stat: 'armor', add: def }, { stat: 'mr', add: def });
  const col = cell % BOARD_COLS;
  const edge = col === 0 || col === BOARD_COLS - 1 ? sum('edgeAtk') : 0;
  if (edge) mods.push({ stat: 'atk', pct: edge }, { stat: 'ap', pct: edge });
  const hp = cell < BOARD_COLS ? sum('frontHp') : 0;
  if (hp) mods.push({ stat: 'hp', add: hp });
  return mods;
}

// Premium Client: after a manual shop refresh (free ones included), a chance to bank a free one. Each card
// held rolls on its own. Returns how many were gained.
export function rollFreeRefresh(state: GameState, p: Player): number {
  let gained = 0;
  for (const c of p.powerCards ?? []) {
    const chance = POWER_CARDS[c.id].freeRefreshChance?.[c.tier];
    if (chance && nextFloat(state) < chance) gained++;
  }
  p.freeRerolls = (p.freeRerolls ?? 0) + gained;
  return gained;
}

// Full Throttle: the share less XP needed per level (the cards held add up).
export const xpCutOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].xpCut?.[c.tier] ?? 0), 0);

// Rising Fury: the share of starting attack gained each second (the cards held add up).
export const berserkOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].berserk?.[c.tier] ?? 0), 0);

// Meltdown Armor: the share of max hp a dying hero blasts around it (the cards held add up).
export const kamikazeOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].kamikaze?.[c.tier] ?? 0), 0);

// Dimensional Shoot: the share more damage per tile between (the cards held add up).
export const sharpshooterOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].sharpshooter?.[c.tier] ?? 0), 0);

// Healing Fountain: commander hp healed each round (the cards held add up).
export const roundHealOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].roundHeal?.[c.tier] ?? 0), 0);

// Mana Sovereign: the share of max mana back-row heroes start with (the cards held add up).
export const backManaOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].backMana?.[c.tier] ?? 0), 0);

// Ethereal Essence: the share of max mana back after each cast (the cards held add up).
export const castRefundOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].castRefund?.[c.tier] ?? 0), 0);

// The shop odds (per cost, in %) at `level`, with Customize Recruitment: each card held adds CUSTOM_UP points to
// its cost (only if that level already rolls it) and takes CUSTOM_DOWN from the cheaper ones it names (not below
// 0), then the whole is scaled back to 100.
export function shopOdds(level: number, p?: Player): number[] {
  const base = SHOP_ODDS[level - 1];
  const odds = [...base];
  for (const c of p?.powerCards ?? []) {
    const o = POWER_CARDS[c.id].shopOdds?.[c.tier];
    if (!o || !base[o.up - 1]) continue;
    odds[o.up - 1] += CUSTOM_UP;
    for (const d of o.down) odds[d - 1] = Math.max(0, odds[d - 1] - CUSTOM_DOWN);
  }
  const total = odds.reduce((a, b) => a + b, 0);
  return total === 100 ? odds : odds.map((n) => (n * 100) / total);
}

// Vanguard Leader: the extra damage the commander takes on a lost fight.
export const hurtExtraOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].hurtExtra?.[c.tier] ?? 0), 0);

// Valor's Embrace: the share of a fallen ally's max hp its Dragon Altar heroes get as a shield.
export const dragonShieldOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].dragonShield?.[c.tier] ?? 0), 0);

// Fortified Defense: the shield a hero with full item slots gives itself and its neighbours.
export const fortifyOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].fortify?.[c.tier] ?? 0), 0);

// Pas de Deux: whether a hero reaching 3★ brings a 2★ copy of it.
export const starGiftOf = (p: Player): boolean => (p.powerCards ?? []).some((c) => POWER_CARDS[c.id].starGift?.[c.tier]);

// An Equipment Chest, opened now unless another offer is up (then it waits its turn).
export function giveChest(state: GameState, p: Player): void {
  (p.chests ??= { kills: 0, earned: 0, waiting: 0 }).waiting++;
  openChest(state, p);
}

// Counter Action, Apex Weaponry, Trust Fund, Neon Zenith: the chests, gold and heroes of each trigger now met, then drops it. Opens the first
// unless another offer is up.
export function checkChestTriggers(state: GameState, p: Player): void {
  if (!p.chestTriggers?.length) return;
  const met = (tr: ChestTrigger) => (tr.hpBelow !== undefined && p.hp < tr.hpBelow) || (tr.level !== undefined && p.level >= tr.level);
  // A hero waits (trigger kept) until there's room for it on the bench or board.
  const room = (tr: ChestTrigger) => !tr.unit || p.bench.includes(null) || p.board.includes(null);
  const due = p.chestTriggers.filter((tr) => met(tr) && room(tr));
  if (!due.length) return;
  p.chestTriggers = p.chestTriggers.filter((tr) => !due.includes(tr));
  for (const tr of due) if (tr.unit) giveUnit(state, p, tr.unit);
  p.gold += due.reduce((n, tr) => n + (tr.gold ?? 0), 0);
  const chests = due.reduce((n, tr) => n + (tr.chests ?? 0), 0);
  if (!chests) return;
  (p.chests ??= { kills: 0, earned: 0, waiting: 0 }).waiting += chests;
  openChest(state, p);
}

// A 1★ hero: a copy from the pool if it has one, else made up (never handed back to the pool). To the bench, else
// the board. Check for room first.
function giveUnit(state: GameState, p: Player, defId: string): void {
  const pooled = (state.pool[defId] ?? 0) > 0;
  if (pooled) state.pool[defId]--;
  const unit = { uid: state.nextUid++, defId, star: 1 as const, ...(!pooled && defId in state.pool ? { shortfall: 1 } : {}) };
  const bench = p.bench.indexOf(null);
  if (bench >= 0) p.bench[bench] = unit;
  else p.board[p.board.indexOf(null)] = unit;
  mergeUnits(p, defId);
}

const held = <K extends keyof PowerCardDef>(p: Player, key: K) =>
  (p.powerCards ?? []).flatMap((c) => {
    const v = (POWER_CARDS[c.id][key] as Partial<Record<PowerTier, unknown>> | undefined)?.[c.tier];
    return v === undefined ? [] : [v];
  });

// Party's Opening: extra heroes allowed on the board.
export const heroCapBonusOf = (p: Player): number => (held(p, 'heroCap') as number[]).reduce((n, v) => n + v, 0);
// Vault Upgrade: the interest limit (the highest a card sets).
export const interestCapOf = (p: Player): number => Math.max(MAX_INTEREST, ...(held(p, 'interestCap') as number[]));
// Opening Promotion: whether its free buy comes back each round.
export const freeBuyOf = (p: Player): boolean => held(p, 'freeBuy').length > 0;
// Shield of Fortune: each card due this round turns what's left of its shield into gold, 1 for 1. Damage wears
// these shields down first (see spendFortunes), so other commander shields never turn into gold.
export function cashFortunes(state: GameState, p: Player): void {
  const due = (p.fortunes ?? []).filter((f) => f.round <= state.round);
  if (!due.length) return;
  const later = p.fortunes!.filter((f) => f.round > state.round);
  p.fortunes = later.length ? later : undefined;
  for (const f of due) {
    const gold = Math.min(f.shield, p.shield ?? 0);
    p.shield = (p.shield ?? 0) - gold || undefined;
    p.gold += gold;
  }
}

// Shield of Fortune: `soaked` commander shield was just spent; it comes out of these cards' shields first, the
// soonest due first.
export function spendFortunes(p: Player, soaked: number): void {
  for (const f of [...(p.fortunes ?? [])].sort((a, b) => a.round - b.round)) {
    const take = Math.min(f.shield, soaked);
    f.shield -= take;
    soaked -= take;
  }
}

// Turret of Guardians: turrets waiting for room, straight onto the board (they take no slot), else the bench.
// Run on every sync.
export function deliverTurrets(state: GameState, p: Player): void {
  while (p.turrets?.length) {
    const cell = p.board.indexOf(null);
    const bench = cell < 0 ? p.bench.indexOf(null) : -1;
    if (bench < 0 && cell < 0) break;
    const { defId, from } = p.turrets.shift()!;
    const unit = { uid: state.nextUid++, defId, star: 1 as const, turretFrom: from };
    if (cell >= 0) p.board[cell] = unit;
    else p.bench[bench] = unit;
  }
  if (p.turrets && !p.turrets.length) p.turrets = undefined;
}

// Turret of Guardians: each turret's star, by the rounds since it came (+1 every TURRET_OF_GUARDIANS.starRounds, to 3★).
export function ageTurrets(state: GameState, p: Player): void {
  for (const u of [...p.board, ...p.bench])
    if (u?.turretFrom !== undefined) u.star = Math.min(3, 1 + Math.floor((state.round - u.turretFrom) / TURRET_OF_GUARDIANS.starRounds)) as Star;
}

// Glorious Claim: after a fight against a player. A win stores gold (paid out once full); a loss pays it all.
export function gloriousClaim(p: Player, won: boolean, lost: boolean): void {
  const rule = (held(p, 'claim') as { store: number; full: number }[])[0];
  if (!rule) return;
  if (won) p.claim = (p.claim ?? 0) + rule.store;
  if (lost || (p.claim ?? 0) >= rule.full) {
    p.gold += p.claim ?? 0;
    p.claim = undefined;
  }
}

// Experienced Shuffle: XP for the first manual shop refresh of the round.
export function refreshXp(state: GameState, p: Player): void {
  const xp = (held(p, 'refreshXp') as number[]).reduce((n, v) => n + v, 0);
  if (!xp || p.refreshXpRound === state.round) return;
  p.refreshXpRound = state.round;
  addXp(p, xp);
}

// Disco Fever: whether the player's fights have the dance; and the uids of their strongest heroes (highest star,
// then cost; board order on ties; Turrets and pieces aside), who get its buff.
export const discoOf = (p: Player): boolean => held(p, 'disco').length > 0;
export function discoStarsOf(p: Player): Set<number> {
  if (!discoOf(p)) return new Set();
  const heroes = p.board.filter((u): u is NonNullable<typeof u> => !!u && !UNIT_BY_ID[u.defId].piece && !UNIT_BY_ID[u.defId].turret);
  const weight = (u: (typeof heroes)[number]) => u.star * 100 + UNIT_BY_ID[u.defId].tier;
  return new Set([...heroes].sort((a, b) => weight(b) - weight(a)).slice(0, DISCO_FEVER.stars).map((u) => u.uid));
}

// Synergy Constellation: the attack and magic attack share it gives with `active` synergies (0 without the card).
export function constellationOf(p: Player, active: number): number {
  if (!held(p, 'constellation').length) return 0;
  return SYNERGY_CONSTELLATION.per * active + (active >= SYNERGY_CONSTELLATION.at ? SYNERGY_CONSTELLATION.bonus : 0);
}

// Divine Execution: the share of max hp under which your heroes' damage executes an enemy (0: none).
export const executeOf = (p: Player): number => Math.max(0, ...(held(p, 'execute') as number[]));

// Golden Era: free shop refreshes per level gained.
export const levelRefreshesOf = (p: Player): number => (held(p, 'levelRefreshes') as number[]).reduce((n, v) => n + v, 0);
// The More the Merrier: gold per active synergy after a fight.
export const traitGoldOf = (p: Player): number => (held(p, 'traitGold') as number[]).reduce((n, v) => n + v, 0);
// Sharp Armory: its per-attack stacking for back-row heroes, if held.
export const sharpArmoryOf = (p: Player) => (held(p, 'sharpArmory') as { pct: number; max: number }[])[0] ?? null;

// Ally's Call: a star-up of `defId` gives a 1★ hero (from the pool, of a cost the shop rolls at this level) that
// shares one of its traits, picked at random; never the same hero. Nothing if none is left or there's no room.
export function allyCall(state: GameState, p: Player, defId: string): void {
  if (!(p.powerCards ?? []).some((c) => POWER_CARDS[c.id].allyCall?.[c.tier])) return;
  const traits = UNIT_BY_ID[defId].traits;
  if (!traits.length) return;
  const trait = traits[nextInt(state, traits.length)];
  const odds = shopOdds(p.level, p);
  const open = UNITS.filter((u) => u.id !== defId && u.shop !== false && !u.locked && !u.piece && u.traits.includes(trait) && odds[u.tier - 1] > 0 && (state.pool[u.id] ?? 0) > 0);
  if (!open.length) return;
  const unit = open[nextInt(state, open.length)].id;
  if (!canClaimToBoard(p, unit)) return;
  state.pool[unit]--;
  gainUnit(state, p, unit, true);
}

// Fully Armed: before the round's fights, each fielded hero holding nothing borrows one random attack equipment
// (physical or magic, by its basic attack) and one random armor piece. returnArms takes them back after.
export function lendArms(state: GameState, p: Player): void {
  if (!(p.powerCards ?? []).some((c) => POWER_CARDS[c.id].fullyArmed?.[c.tier])) return;
  const of = (group: string) => EQUIPMENT.filter((id) => ITEMS[id].group === group);
  for (const u of p.board) {
    if (!u || UNIT_BY_ID[u.defId].piece || p.items.some((i) => i.holder === u.uid)) continue;
    const attack = of(UNIT_BY_ID[u.defId].attackType === 'magic' ? 'magic' : 'physical');
    for (const pool of [attack, of('armor')]) p.items.push({ uid: state.nextUid++, id: pool[nextInt(state, pool.length)], tier: 1, holder: u.uid, loan: true });
  }
}

export function returnArms(p: Player): void {
  if (p.items.some((i) => i.loan)) p.items = p.items.filter((i) => !i.loan);
}

// Hero cards: their 3★ heroes, as room allows (the rest wait; run on every sync).
export function deliverSignatures(state: GameState, p: Player): void {
  while (p.signatures?.length && giveStarred(state, p, p.signatures[0], 3, 0, { signature: true }, false)) p.signatures.shift();
  if (p.signatures && !p.signatures.length) p.signatures = undefined;
}

// Emergency Rift: souls for the grave now (it appears if it hadn't), and a second Plane Wanderer different from
// the grave's (or, before that's picked, from those on offer). It waits for room in Player.rift.
function openRift(state: GameState, p: Player, souls: number): void {
  const rule = TRAITS.necromancer.stacks!;
  p.stacks.necromancer = Math.min(rule.max, (p.stacks.necromancer ?? 0) + souls);
  const options = rule.rewardUnits!;
  rewardUnit(state, p, 'necromancer'); // the grave's own: rolled (or its offer rolled) if it wasn't yet
  const taken = new Set([p.rewardUnit?.necromancer, ...(p.rewardOffer?.necromancer ?? []), p.rift?.defId]);
  const others = options.filter((id) => !taken.has(id));
  p.rift = { defId: others[nextInt(state, others.length)], given: false };
  syncRift(state, p);
}

// Emergency Rift: hands out the second Plane Wanderer once there's room, and makes it 2★ from
// EMERGENCY_RIFT.round on (never more). Run on every sync.
export function syncRift(state: GameState, p: Player): void {
  const rift = p.rift;
  if (!rift) return;
  if (!rift.given && (p.bench.includes(null) || p.board.includes(null))) {
    const unit = { uid: state.nextUid++, defId: rift.defId, star: 1 as const };
    const bench = p.bench.indexOf(null);
    if (bench >= 0) p.bench[bench] = unit;
    else p.board[p.board.indexOf(null)] = unit;
    rift.given = true;
  }
  if (state.round >= EMERGENCY_RIFT.round) for (const u of [...p.board, ...p.bench]) if (u?.defId === rift.defId && u.star < 2) u.star = 2;
}

// The items the player's cards keep enhanced (base ids).
export const enhancedItemsOf = (p: Player): Set<string> =>
  new Set([...(p.powerCards ?? []).flatMap((c) => POWER_CARDS[c.id].enhances?.[c.tier] ?? []), ...(p.enhancedItems ?? [])]);
// Enhances every owned item a card says to (run on the pick and whenever items change, see syncItems).
export function enhanceOwned(p: Player): void {
  const ids = enhancedItemsOf(p);
  if (!ids.size) return;
  for (const it of p.items) if (ids.has(it.id)) enhanceItem(it);
}

// Exclusive Offering: extra Pyre Offerings, and the share each gives (null: the item's own).
export const extraOfferingsOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].offerings?.[c.tier]?.extra ?? 0), 0);
export const offeringShareOf = (p: Player): number | null =>
  (p.powerCards ?? []).reduce<number | null>((n, c) => POWER_CARDS[c.id].offerings?.[c.tier]?.share ?? n, null);

// Transmutation: each card due this round leaves, and a random gold power card takes its place (its pick
// effects happen as if picked).
export function transmute(state: GameState, p: Player): void {
  const due = (p.transmutes ?? []).filter((r) => r <= state.round);
  if (!due.length) return;
  p.transmutes = p.transmutes!.filter((r) => r > state.round);
  for (const _ of due) {
    const at = (p.powerCards ?? []).findIndex((c) => POWER_CARDS[c.id].transmute);
    if (at >= 0) p.powerCards!.splice(at, 1);
    const pool = powerPool('gold', p);
    gainPowerCard(state, p, pool[nextInt(state, pool.length)], 'gold');
  }
}

// The trait perks the player's cards give.
export const perksOf = (p: Player): Set<Perk> =>
  new Set((p.powerCards ?? []).flatMap((c) => (POWER_CARDS[c.id].perk?.[c.tier] ? [POWER_CARDS[c.id].perk![c.tier]!] : [])));

// Adequate Stock: at the start of a round, a free shop refresh for each card whose cycle comes round (banked).
export function cycleRefreshes(state: GameState, p: Player): void {
  for (const c of p.refreshCycles ?? []) if (state.round > c.from && (state.round - c.from) % c.every === 0) p.freeRerolls = (p.freeRerolls ?? 0) + 1;
}

// Astral Judgement: whether the side's Astral Sovereigns bolt the enemies their skills hit.
export const judgementOf = (p: Player): boolean => (p.powerCards ?? []).some((c) => POWER_CARDS[c.id].judgement?.[c.tier]);

// Crushing Claw: whether the side's Skybringer lightning hits harder, as pure damage, and lowers defenses.
export const crushingClawOf = (p: Player): boolean => (p.powerCards ?? []).some((c) => POWER_CARDS[c.id].crushingClaw?.[c.tier]);

// Cyclical Support: at the start of a round, a chest for each card whose cycle comes round.
export function cycleChests(state: GameState, p: Player): void {
  for (const c of p.chestCycles ?? []) if (state.round > c.from && (state.round - c.from) % c.every === 0) giveChest(state, p);
}

// Dark Blade: the share its heroes' damage cuts healing by (the cards held add up, at most all of it).
export const antiHealOf = (p: Player): number =>
  Math.min(1, (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].antiHeal?.[c.tier] ?? 0), 0));

// Prime Selection, Legacy of Valor, badges: a faction or role orb (a Mist orb) to the inventory, to put on a hero like an item.
export function giveFactionOrb(state: GameState, p: Player, trait: string): void {
  (p.mistOrbs ??= []).push({ uid: state.nextUid++, trait, holder: null });
}

export function pickFactionOrb(state: GameState, p: Player, trait: string): string | null {
  if (!p.factionOrbOffer?.includes(trait)) return "That orb isn't on offer";
  p.factionOrbOffer = undefined;
  giveFactionOrb(state, p, trait);
  return null;
}
