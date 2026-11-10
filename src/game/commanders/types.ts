import type { StatKey, StatMod } from '../stats';
import type { Term } from './terms';
// Commanders: each player picks one at the start of the game. The commander is the player: it holds
// their hp, and its innate power works for them all game. On round COMMANDER_CARD_ROUND every player
// picks one commander card; a card does one thing for its own commander (an upgrade) and another for
// anyone else (usually that commander's innate power).

// Lukas's power: a divine beast placed on the board (taking no slot) that fires once when a fight
// starts, then vanishes. From the back two rows it beams the 3x3 with the most enemies, stunning
// them; from the front row (only once `frontRow` is unlocked) it hits the 3x1 right ahead of it and
// tears their armor and magic resist.
export interface BeastPower {
  damage: number; // share of each target's max hp, as magic damage
  stun: number; // seconds, back-row beam
  frontRow: boolean; // may stand on the front row
  shred: number; // front-row shot: share of armor and magic resist removed
  shredSeconds: number;
}

// Kagura's umbrella: during preparation the player marks one hero (Player.marks.ward). The first time it
// drops below `below` of its max hp in a fight, it gets a shield of `shield` of its max hp for the rest of it.
export interface WardPower {
  below: number;
  shield: number;
}

// Kagura's card on herself: a second mark (Player.marks.boost), on the same hero or another. That hero
// fights with more attack and magic attack, and hybrid lifesteal (basic attacks and spells).
export interface BoostPower {
  hybridAtk: number; // + share of attack and magic attack
  hybridLifesteal: number;
}

// Angela's protection: `picks` heroes the player marks (halos), plus one picked automatically (the
// fielded hero with the most items, not already picked). Protected heroes deal more skill damage and get
// a share of their max mana back every time they cast.
export interface ProtectPower {
  picks: number;
  skillAmp: number;
  refund: number; // share of max mana regained after each cast
}

// What a commander or a card grants. Powers are merged in order, field by field: a later one overrides
// an earlier one (a card's upgrade replaces the innate version of the same power).
export interface CommanderPower {
  beast?: BeastPower;
  ward?: WardPower;
  boost?: BoostPower;
  protect?: ProtectPower;
  roundGold?: { win: number; loss: number }; // extra gold after each fight won or lost (a draw pays nothing)
  pickGold?: number; // gold paid once, when this card is picked
  pickItem?: string; // item handed over once, when this card is picked
  pickChest?: number; // Equipment Chests handed over once, when this card is picked
  pickFreeHeroes?: number; // Guiness's card: the next this-many after-fight shops each have a free hero
  startChests?: number; // Equipment Chests handed over once, when this power first works (Guiness)
  freeHeroChance?: number; // Guiness: chance the after-fight shop has a free hero
  pickMirrors?: number; // Mirror Devices handed over once, when this card is picked (Amon's card on another commander)
  gloveRounds?: { round: number; glove: string }[]; // Pacquiao: a boxing glove from each round on (see gloves.ts)
  pickGloves?: string[]; // Pacquiao's card: gloves handed over on the pick
  duel?: DuelPower; // Lung: the Dueling Ring
  levelHero?: { levels: number[]; tier: number }; // Lung's card: the same random hero of this cost at each of these levels
  itemBoost?: { item: string; mods: StatMod[] }; // Katarina's card: the holder of this item (or its enhanced version) gets these too
  startEnhancers?: number; // Minos: Enhancement Charges handed over once, when this power first works (see enhancer.ts)
  pickEquipment?: number; // Minos's card: this many random equipment, straight to the inventory, on the pick
  // Nana: lethal hits survived (left at 1 HP), in all. A card's count replaces the innate one, it doesn't add.
  deathSaves?: number;
  hurtGold?: HurtGoldPower;
  trove?: TrovePower;
  // Ruby: items handed over once, when this power first works for the player (picking the commander, or
  // picking a card that lends it).
  startItems?: string[];
  survivorGold?: SurvivorGoldPower;
  // Dyroth: altars beside the board (two fields, so his card's altar sits next to his own). See altar.ts.
  altar?: AltarPower;
  secondAltar?: AltarPower;
  // Miya: the Ice Arrow Blessing, a hero mark (Player.marks.iceArrow).
  iceArrow?: IceArrowPower;
  // Alice: the Blood Pact (see blood.ts).
  bloodPact?: BloodPower;
  // Alice's card: every Blood Pact hero gets this share more attack and magic attack.
  bloodAtk?: number;
  // XP when the card is picked (paid once).
  pickXp?: number;
  // Lunox: a Twilight Blessing, handed out with the card pick (see twilight.ts).
  twilight?: TwilightPower;
  essence?: EssencePower; // Luo Yi: the Essence Altar
  echo?: EchoPower; // Luo Yi's card: copies of one hero, round after round
  // Lunox's card: the first time the blessed trait reaches `count`, `gold`.
  twilightGold?: { count: number; gold: number };
  // Kaela's card: Lucky Dice rolled for the player on these rounds (or on the pick, if it comes later), each
  // paying a random prize worth between `min` and `max` gold. See luckyDice.ts.
  luckyRolls?: { round: number; min: number; max: number }[];
  johnnie?: JohnniePower; // Johnson: Johnnie's Den (see johnnie.ts)
  johnnieBuff?: { hybridAtk: number; hp: number }; // Johnson's card: every Johnnie gets these shares more
  johnniePool?: number; // Johnson's card: extra copies the player's Johnnie rolls with in the shop
  mirrorBar?: MirrorBarPower; // Amon (see mirrorBar.ts)
  starGold?: StarGoldPower; // Amon's card
  rally?: RallyPower; // Cyclops: once, at low hp (see cyclops.ts in game/)
  heirShare?: number; // Cyclops: of a knocked-out player's hero value, as gold
  heirShareCard?: number; // Cyclops's card: the same again (a separate field, so the two add up)
  tierUp?: number; // Zhu Yong: every power card round offers this many tiers higher (blue, purple, gold)
  tierUpCard?: number; // his card: the same again (a separate field, so the two add up)
  treasure?: TreasurePower; // Zhu Yong: Black Dragon Treasures
  frost?: FrostPower; // Aurora: a frozen shop, and Frost Energy for rounds without a purchase
  idlePrize?: IdlePrizePower; // Aurora's card: a prize for each round without a purchase
  tierShop?: TierShopPower; // Harley: Full House charges (a shop of one cost, and a free buy)
  tierShopCard?: TierShopPower; // his card: its own charges (a separate field, so both work)
  ritual?: RitualPower; // Moscow: the Shadow Altar's ritual, and its charge
  ladder?: LadderPower; // Moscow's card: a hero of each cost, one a round
  loveBeam?: LoveBeamPower; // Angela's card: protected heroes fire Love Beams
  enhance?: EnhancePower; // Freya (see freya.ts in game/)
  enhanceExtra?: { gold: number }; // Freya's card: more with every reward claimed
}

// Moscow: the Shadow Altar names a random hero of each of `costs`; all offered, a charge: `copies` more copies of
// a hero, made from nothing.
export interface RitualPower {
  costs: number[];
  copies: number;
}

// Moscow's card: a random hero of `tiers[0]` cost on the pick, then one of each next cost at each round start.
export interface LadderPower {
  tiers: number[];
}

// Harley: a charge on round `first` and every `every` rounds after. Using one fills the shop with `tier`-cost
// heroes, and `free` heroes bought that round cost nothing.
export interface TierShopPower {
  first: number;
  every: number;
  tier: number;
  free: number;
}

// Aurora: the shop locks itself at every round start. Each round without a purchase gives `gain` Frost Energy, paid
// at the next round start; at `need`, a random prize worth `min` to `max` gold, and back to 0.
export interface FrostPower {
  gain: number;
  need: number;
  min: number;
  max: number;
}

// Aurora's card: each round without a purchase, a random prize worth `min` to `max` gold at the next round start;
// `times`: at most this many (no cap without).
export interface IdlePrizePower {
  min: number;
  max: number;
  times?: number;
}

// Zhu Yong: a Black Dragon Treasure on `round`, and one for every tier a power card round is raised past gold.
// Each pays one prize at random: a faction or role orb; an Equipment Chest and `chestGold`; `heroes` random heroes
// of the biggest trait; or `gold`.
export interface TreasurePower {
  round: number;
  chestGold: number;
  heroes: number;
  gold: number;
}

// Cyclops: the first time the player is at `hp` or below, `heroes` random heroes of their biggest trait
// and `chests` Equipment Chests.
export interface RallyPower {
  hp: number;
  heroes: number;
  chests: number;
}

// Angela's card: every `every` seconds each protected hero beams a line through its target to the board's
// edge: allies on it heal `heal` of their max hp, enemies take `damage` by stage (index 0 = stage I; the
// last value from then on), magic.
export interface LoveBeamPower {
  every: number;
  heal: number;
  damage: number[];
}

// Freya's blessing: per blessable trait, its extra stat mods per level; and the rewards' worth per level.
export interface EnhancePower {
  traits: Record<string, { text: string; members: boolean; mods: { stat: StatKey; add?: number[]; pct?: number[] }[] }>;
  rewardGold: number[];
}

// Amon's Mirror Bar: `start` Mirror Devices at once; every hero reaching 2 stars is a step, and `steps`
// steps make another device and pay `gold`, up to `max` devices from the bar.
export interface MirrorBarPower {
  start: number;
  steps: number;
  max: number;
  gold: number;
}

// Amon's card: `gold` every time a hero reaches 2 stars, up to `max` gold a game.
export interface StarGoldPower {
  gold: number;
  max: number;
}

// Johnson's Johnnie's Den: `offer` Johnnies to pick from, all different factions and roles.
export interface JohnniePower {
  offer: number;
}

// Ruby's card: after each fight, `gold` for every one of `items` whose holder is still standing at the end
// (a unit holding two counts twice), up to `max` gold a game.
export interface SurvivorGoldPower {
  gold: number;
  items: string[];
  max: number;
}

// Dyroth's altars: from round `first`, place a hero (it's gone, its copies back to the pool) for 1-star heroes
// of the next cost up: `traits` gives one sharing its faction and one sharing its role, `random` one at random.
// Then it's ready again `every` rounds after that use.
export interface AltarPower {
  name: string;
  icon: string;
  first: number;
  every: number;
  gifts: 'traits' | 'random';
  xp: number; // xp the player gets for every offering
}

// Miya's Ice Arrow Blessing on one hero: +`attackSpeed`, and every `every`th basic attack also shoots the
// `targets` nearest enemies for `share` of each one's max hp, physical.
// Lung's Dueling Ring: a board cell. The hero on it gets more attack speed and, when the fight starts, drags the
// farthest enemy into a 1v1 of basic attacks for up to `seconds`. Each duel won: +perWin attack and magic attack
// for the ring's hero, kept all game (Player.duelWins), up to maxWins.
export interface DuelPower {
  cell: number;
  seconds: number;
  attackSpeed: number;
  perWin: number;
  maxWins: number;
}

export interface IceArrowPower {
  every: number;
  targets: number;
  share: number;
  attackSpeed: number;
}

// Alice's Blood Pact: a use on each of `rounds`; past 3 stars each copy is +`perCopy` hybrid attack and max hp.
export interface BloodPower {
  rounds: number[];
  perCopy: number;
}

// Lunox's Twilight Blessing: `gold` when it's handed out, and `heroes` random heroes (costs by the shop odds) of the rolled
// trait once it's placed.
export interface EssencePower {
  share: number; // of the altar hero's stats and its items' stats the core's holder gets
}

export interface EchoPower {
  tier: number; // cost of the hero rolled
  total: number; // copies handed out in all (the first when the card is picked, then one a round)
}

export interface TwilightPower {
  heroes: number;
  gold: number;
}

// Kaela's treasure trove: a roll a round (unused ones bank up), the player may roll a die (1..`die`) and add it to their points; going
// past `max` drops them to 0. Opening it pays a prize worth `value[points]` gold and resets the points, up to
// `opens` times a game. See luckyDice.ts.
export interface TrovePower {
  die: number;
  max: number;
  opens: number;
  value: number[]; // by points, 0..max
}

// Nana: every `every` damage the player takes (counted while the power works) pays `gold`, up to `times`
// times; the last payout also gives an Equipment Chest when `chest` is set.
export interface HurtGoldPower {
  every: number;
  gold: number;
  times: number;
  chest: boolean;
}

export interface CommanderCard {
  name: string;
  icon: string;
  selfDesc: string; // on its own commander
  self: CommanderPower;
  otherDesc?: string; // on any other commander; defaults to the commander's innate description
  other?: CommanderPower; // defaults to the commander's innate power
}

export interface CommanderDef {
  id: string;
  name: string;
  icon: string;
  title: string; // a short epithet
  desc: string; // the innate power
  innate: CommanderPower;
  card: CommanderCard;
  terms?: Record<string, Term>; // the fine print its texts link to (term() in terms.ts)
}
