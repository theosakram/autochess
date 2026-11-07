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

// Lunox's Twilight Blessing: `gold` when it's handed out, and `heroes` random 1- or 2-cost heroes of the rolled
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

// Kaela's treasure trove: once a round the player may roll a die (1..`die`) and add it to their points; going
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
}
