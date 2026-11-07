export type Tier = 1 | 2 | 3 | 4 | 5 | 7; // 7: the one 7-gold unit
export type Star = 1 | 2 | 3;

export interface UnitDef {
  id: string;
  name: string;
  tier: Tier; // also the gold cost
  traits: string[]; // trait ids, see traits.ts
  // 1★ combat stats; higher stars scale hp, atk and ap by STAR_MULT.
  hp: number;
  atk: number; // physical attack: physical basic attacks, "attack"-scaled effects
  ap: number; // magic attack: magic basic attacks and magic skill damage
  armor: number; // reduces physical damage
  mr: number; // magic resist, reduces magic damage
  mana: number; // max mana; casts when full
  range: number; // in cells, Chebyshev distance
  attackTicks: number; // ticks between attacks
  skill?: string; // skill id (see skills/); without one the unit uses the placeholder cast
  shop?: false; // false: never in the shop or the pool; only handed out (e.g. by a trait reward)
  price?: number; // gold to buy (and what it sells for), if not its tier
  // Johnson's Johnnie: one def per faction + role pair (see JOHNNIES). Never in the shared pool: it shows
  // up in the shop only for the player whose Johnnie it is (Player.johnnie).
  johnnie?: true;
  locked?: true; // in a player's shop only once something unlocks it for them (Player.unlocked)
  shopTier?: Tier; // the shop odds column it's rolled under, if not its own tier
  mergeSize?: number; // same-star copies that merge into the next star (default 3)
  freeSlot?: true; // doesn't count toward the board limit (level)
  summon?: true; // only exists inside a fight, summoned by a skill: never owned, shown or sold
  // A commander's board piece (e.g. Lukas's Divine Beast): placed like a unit, but takes no slot, never
  // fights, counts, sells or holds anything. See commanders/.
  piece?: true;
  monster?: true; // only fights in monster rounds (see monsters.ts): never owned, shown or sold
  // Gets this trait's member bonuses without being a member or counting toward it (like an item bearer).
  honorary?: { trait: string; icon: string };
  attackType?: 'physical' | 'magic'; // damage type of basic attacks; physical if unset
  // Hand-set hp, atk and ap per star (index 0 = 1★), instead of scaling the 1★ stats by STAR_MULT.
  // A 4★ (from star bonuses) scales the 3★ values by STAR_MULT's 4★/3★ step.
  // `mana`, if given, sets max mana per star the same way (a 4★ uses the 3★ value).
  starStats?: { hp: number[]; atk: number[]; ap: number[]; mana?: number[]; attackTicks?: number[] };
}

export interface Unit {
  uid: number;
  defId: string;
  star: Star;
  copies?: number; // Alice's Blood Pact: 1-star copies piled into this hero (its star follows them)
}

export interface MistOrb {
  uid: number;
  trait: string;
  holder: number | null; // unit uid
}

export interface Item {
  uid: number;
  id: string; // item def id, see items/
  tier: number;
  holder: number | null; // uid of the unit holding it, null = in the inventory
}

// An applied Magic Orb: every fielded unit of this type adds +1 to this trait.
export interface Orb {
  defId: string;
  trait: string;
}

export type BotLevel = 'easy' | 'normal';

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  botLevel?: BotLevel; // how a bot plays (see bot.ts); easy if unset
  hp: number;
  gold: number;
  level: number;
  xp: number;
  bench: (Unit | null)[];
  board: (Unit | null)[]; // row-major, BOARD_COLS * BOARD_ROWS, row 0 is the front line
  shop: (string | null)[]; // unit def ids, already taken out of the pool
  shopLocked: boolean; // skip the next free refresh, then unlock
  place: number | null; // finishing position, set once eliminated (or on winning)
  stacks: Record<string, number>; // trait id -> counter kept all game (e.g. Storyweaver stories)
  rewards?: Record<string, number>; // trait id -> how many of its stack rewards were handed out
  rewardUnit?: Record<string, string>; // trait id -> the reward unit rolled for this player (see stacks.rewardUnits)
  promotions?: { defId: string; star: Star }[]; // merges since the last sync, for traits that react to them
  gifts?: string[]; // free units already taken from the pool, waiting for bench room
  unlocked?: string[]; // locked unit ids this player's shop may now offer
  mistShop?: string[]; // the Mist Shop's 3 wares on offer (see mistShop.ts), once it has opened
  mistBonus?: { atk: number; def: number }; // bought Blades / Shields: % attack and magic attack, % armor and mr, for every fielded unit
  // Mist orbs (from the Mist Shop), held like items: +1 to `trait` while the holder is fielded. Back to
  // the inventory (holder null) when the holder leaves; movable any time. See mistShop.ts.
  mistOrbs?: MistOrb[];
  items: Item[];
  orbs: number[]; // unused Magic Orbs (each one's seed)
  orb: Orb | null; // the one in use
  commander: string | null; // commander id, picked at the start of the game (see commanders/)
  commanderCard?: string | null; // the commander card picked (a commander id)
  cardOffer?: string[]; // commander cards on offer, waiting for a pick
  itemOffer?: string[]; // items on offer (round-2 basics, monster loot, an Equipment Chest), waiting for a pick
  offerFrom?: 'basic' | 'loot' | 'chest'; // where the current itemOffer comes from
  loot?: number; // monster loot picks not opened yet (each opens as the one before is picked)
  chests?: { kills: number; earned: number; waiting: number }; // Equipment Chests: kills toward the next, earned so far, not opened yet
  deathsSaved?: number; // lethal hits survived so far (Nana)
  hurt?: { taken: number; paid: number }; // damage taken toward Nana's gold, and payouts made
  trove?: { points: number; rolls: number; rolledRound: number; opens: number; lastRoll: number | null; bust: boolean }; // Kaela's Treasure Grove
  luck?: { rolled: number[]; last: string | null }; // Lucky Dice: card rolls done (by round), and the latest prize
  mirrors?: number; // Mirror Devices won, waiting for a unit to copy
  mirrorBar?: { steps: number; made: number }; // Amon's Mirror Bar: steps filled, devices it has made
  starGold?: number; // gold paid so far by Amon's card
  freya?: { trait: string | null; claimed: number[] };
  rallied?: { trait: string | null; heroes: string[] }; // Cyclops's low-hp rally, once given: the trait and heroes it gave
  heirGold?: number;
  freeSlot?: number | null; // the shop slot whose hero is free this round (Guiness), until bought or refreshed
  freeHeroes?: number; // Guiness's card: after-fight shops left that get a free hero // gold Cyclops's powers paid from knockouts so far // Freya: the blessed role, and the reward levels (1-3) claimed
  survivorGold?: number; // gold paid so far by Ruby's card
  streak?: number; // fights against players: +n won in a row, -n lost in a row
  // Lunox's Twilight Blessing: the unit (uid) it's on, or null until placed; its rolled trait; heroes it gave;
  // whether his card's gold for the trait reaching its count was paid.
  twilight?: { holder: number | null; trait: string | null; gifts?: string[]; paid?: boolean };
  // Alice's Blood Pact: hero types blessed, uses left, and the rounds whose use was handed out.
  blood?: { blessed: string[]; uses: number; rounds: number[] };
  // Luo Yi's Essence Altar: the hero on it (off the board and bench) and the items it held, locked in its core.
  essence?: { hero: Unit | null; items: Item[] };
  // Johnson's Johnnie's Den: the Johnnies on offer (def ids) until one is picked, then the one picked.
  johnnie?: { offer: string[]; defId: string | null };
  echo?: { defId: string; given: number }; // Luo Yi's card: the hero it hands out, and copies given so far
  altars?: Partial<Record<'altar' | 'secondAltar', number>>; // Dyroth's altars: the round each next earns a use, once one is spent
  altarUses?: Partial<Record<'altar' | 'secondAltar', number>>; // uses banked when the last one was spent
  altarLast?: { key: 'altar' | 'secondAltar'; offered: string; gifts: string[] }; // the latest offering, for the UI
  // Heroes marked by commander powers (Kagura's umbrella and dance), by mark kind. See commanders/.
  marks?: Partial<Record<'ward' | 'boost' | 'halo' | 'halo2' | 'iceArrow', { uid: number; defId: string } | null>>;
}

// Plain data only, so the whole state can be serialized and sent over the wire later.
export interface GameState {
  round: number;
  rng: number;
  nextUid: number;
  pool: Record<string, number>;
  players: Player[];
  chosen: Record<string, string>; // trait id -> unit def id it picked for the whole game, same for everyone
}

export type Area = 'bench' | 'board';

export interface Loc {
  area: Area;
  index: number;
}
