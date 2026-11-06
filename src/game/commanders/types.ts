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
