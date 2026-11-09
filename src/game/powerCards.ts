import { BOARD_COLS, CARD_OFFER_SIZE, MAX_ITEMS_PER_UNIT, POWER_CARD_ROUNDS } from './config';
import { addXp } from './player';
import { nextFloat, nextInt, shuffle } from './rng';
import type { StatMod } from './stats';
import { TRAITS } from './traits';
import type { GameState, Player, PowerTier } from './types';

// Power cards: picked on POWER_CARD_ROUNDS, at the tier the match rolled for that round (blue I, purple II,
// gold III). Each card's numbers are by tier.
export interface PowerCardDef {
  id: string;
  name: string;
  icon: string;
  desc: (tier: PowerTier) => string;
  attackMana?: Record<PowerTier, number>; // heroes holding equipment: bonus mana on every basic attack
  hybridLifesteal?: Record<PowerTier, number>; // every fielded hero: lifesteal and spell lifesteal
  freeRefreshChance?: Record<PowerTier, number>; // a manual shop refresh: chance of a free one banked
  berserk?: Record<PowerTier, number>; // every hero: share more atk/ap each second alive, up to BERSERK_SECONDS
  kamikaze?: Record<PowerTier, number>; // every hero: on death, share of its max hp at the enemies around it
  sharpshooter?: Record<PowerTier, number>; // every hero: share more damage per tile between it and its target
  lucky?: Record<PowerTier, [number, number]>; // gold on the pick: one or the other, 50/50
  pickGold?: Record<PowerTier, number>; // gold on the pick
  teamwork?: Record<PowerTier, number>; // heroes in a synergy of TEAMWORK_COUNT+: share more attack/magic attack, per such synergy
  loaded?: Record<PowerTier, number>; // heroes holding MAX_ITEMS_PER_UNIT items: share more damage
  sturdy?: Record<PowerTier, number>; // every hero: share more max hp, attack and magic attack
  skillAmp?: Record<PowerTier, number>; // every hero: share more skill damage
  castRefund?: Record<PowerTier, number>; // every hero: share of max mana back after each cast
  backMana?: Record<PowerTier, number>; // back-row heroes: share of max mana at the start of a fight
  factionOrbChoices?: Record<PowerTier, number>; // a faction orb, chosen out of this many random factions
  frontDef?: Record<PowerTier, number>; // front-row heroes: flat armor and magic resist
  pickRerolls?: Record<PowerTier, number>; // free shop refreshes banked on the pick
  pickShield?: Record<PowerTier, number>; // commander shield on the pick
  roundHeal?: Record<PowerTier, number>; // commander hp healed at the start of every round (up to START_HP)
  xpCut?: Record<PowerTier, number>; // share less XP needed for each level
  payday?: Record<PowerTier, { gold: number; rounds: number }>; // gold on the pick, then as much for `rounds` rounds
}

export const TIER_NUMERAL: Record<PowerTier, string> = { blue: 'I', purple: 'II', gold: 'III' };

const MAGIC_SURGE = { blue: 4, purple: 8, gold: 16 };
const BREATH_OF_THE_WILD = { blue: 0.08, purple: 0.16, gold: 0.32 };
const PREMIUM_CLIENT = { blue: 0.25, purple: 0.35, gold: 0.45 };
export const BERSERK_SECONDS = 15;
const BERSERK = { blue: 0.01, purple: 0.02, gold: 0.03 };
const KAMIKAZE = { blue: 0.1, purple: 0.2, gold: 0.3 };
const SHARPSHOOTER = { blue: 0.06, purple: 0.08, gold: 0.1 };
const FEELING_LUCKY: Record<PowerTier, [number, number]> = { blue: [5, 10], purple: [7, 14], gold: [9, 18] };
const HEALING_FOUNTAIN = { blue: 3, purple: 4, gold: 5 };
const PALADIN = { blue: 20, purple: 30, gold: 40 };
const SHOPPING_SPREE = { blue: 6, purple: 12, gold: 18 };
const SOLID_FRONT = { blue: 20, purple: 35, gold: 50 };
const MANA_SOVEREIGN = { blue: 0.25, purple: 0.5, gold: 0.75 };
const ANGELS_BLESSING = { amp: { blue: 0.1, purple: 0.2, gold: 0.3 }, refund: { blue: 0.1, purple: 0.15, gold: 0.2 } };
const STURDY_WARRIOR = { blue: 0.05, purple: 0.1, gold: 0.15 };
const FULLY_LOADED = { blue: 0.1, purple: 0.2, gold: 0.3 };
export const TEAMWORK_COUNT = 6;
const TEAMWORK = { blue: 0.2, purple: 0.25, gold: 0.3 };
const FACTION_SYNERGY = { blue: 1, purple: 2, gold: 3 };
const FAST_GROWTH = { blue: 0.15, purple: 0.2, gold: 0.25 };
const PAYDAY = { blue: { gold: 6, rounds: 1 }, purple: { gold: 7, rounds: 2 }, gold: { gold: 8, rounds: 3 } };

export const POWER_CARDS: Record<string, PowerCardDef> = {
  magicSurge: {
    id: 'magicSurge',
    name: 'Magic Surge',
    icon: '🌀',
    attackMana: MAGIC_SURGE,
    desc: (t) => `Heroes holding equipment gain <b>${MAGIC_SURGE[t]}</b> bonus mana with every attack.`,
  },
  breathOfTheWild: {
    id: 'breathOfTheWild',
    name: 'Breath of the Wild',
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
    name: 'Fast Growth',
    icon: '🌱',
    xpCut: FAST_GROWTH,
    desc: (t) => `XP needed to level up is reduced by <b>${FAST_GROWTH[t] * 100}%</b>.`,
  },
  berserk: {
    id: 'berserk',
    name: 'Berserk',
    icon: '😤',
    berserk: BERSERK,
    desc: (t) =>
      `All your heroes gain <b>${BERSERK[t] * 100}%</b> hybrid attack every second they survive in a fight, for up to ${BERSERK_SECONDS}s (<b>${Math.round(BERSERK[t] * BERSERK_SECONDS * 100)}%</b>).`,
  },
  kamikaze: {
    id: 'kamikaze',
    name: 'Kamikaze',
    icon: '💥',
    kamikaze: KAMIKAZE,
    desc: (t) => `When one of your heroes dies, it explodes: enemies on the tiles around it take <b>${KAMIKAZE[t] * 100}%</b> of its max hp as magic damage.`,
  },
  sharpshooter: {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    icon: '🎯',
    sharpshooter: SHARPSHOOTER,
    desc: (t) => `Your heroes deal <b>${SHARPSHOOTER[t] * 100}%</b> bonus damage for every tile between them and their target.`,
  },
  feelingLucky: {
    id: 'feelingLucky',
    name: 'Feeling Lucky',
    icon: '🎲',
    lucky: FEELING_LUCKY,
    desc: (t) => `Gain gold now: 50% chance of <b>${FEELING_LUCKY[t][0]}</b>, 50% chance of <b>${FEELING_LUCKY[t][1]}</b>.`,
  },
  healingFountain: {
    id: 'healingFountain',
    name: 'Healing Fountain',
    icon: '⛲',
    pickGold: HEALING_FOUNTAIN,
    roundHeal: HEALING_FOUNTAIN,
    desc: (t) => `Gain <b>${HEALING_FOUNTAIN[t]}</b> gold now. Your commander heals <b>${HEALING_FOUNTAIN[t]}</b> HP at the start of every round.`,
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    icon: '🛡️',
    pickShield: PALADIN,
    desc: (t) => `Your commander gains a <b>${PALADIN[t]}</b> shield. It takes the damage from lost fights before your HP does.`,
  },
  shoppingSpree: {
    id: 'shoppingSpree',
    name: 'Shopping Spree',
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
  manaSovereign: {
    id: 'manaSovereign',
    name: 'Mana Sovereign',
    icon: '🔷',
    backMana: MANA_SOVEREIGN,
    desc: (t) => `Your heroes on the back row start every fight with <b>${MANA_SOVEREIGN[t] * 100}%</b> of their mana.`,
  },
  angelsBlessing: {
    id: 'angelsBlessing',
    name: "Angel's Blessing",
    icon: '👼',
    skillAmp: ANGELS_BLESSING.amp,
    castRefund: ANGELS_BLESSING.refund,
    desc: (t) =>
      `All your heroes deal <b>${ANGELS_BLESSING.amp[t] * 100}%</b> more skill damage, and get <b>${ANGELS_BLESSING.refund[t] * 100}%</b> of their mana back after casting a skill.`,
  },
  sturdyWarrior: {
    id: 'sturdyWarrior',
    name: 'Sturdy Warrior',
    icon: '💪',
    sturdy: STURDY_WARRIOR,
    desc: (t) => `All your heroes gain <b>${STURDY_WARRIOR[t] * 100}%</b> max HP and <b>${STURDY_WARRIOR[t] * 100}%</b> hybrid attack.`,
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
    name: 'Teamwork',
    icon: '🤝',
    teamwork: TEAMWORK,
    desc: (t) => `Your heroes in a synergy of ${TEAMWORK_COUNT} or more gain <b>${TEAMWORK[t] * 100}%</b> hybrid attack.`,
  },
  factionSynergy: {
    id: 'factionSynergy',
    name: 'Faction Synergy',
    icon: '🔵',
    factionOrbChoices: FACTION_SYNERGY,
    desc: (t) =>
      FACTION_SYNERGY[t] === 1
        ? 'Gain a random faction orb: put it on a hero for +1 to that faction.'
        : `Choose a faction orb out of <b>${FACTION_SYNERGY[t]}</b> random factions: put it on a hero for +1 to that faction.`,
  },
};

export const powerCardName = (id: string, tier: PowerTier) => `${POWER_CARDS[id].name} ${TIER_NUMERAL[tier]}`;

// The tier on offer this round, if it's a power card round.
export const powerTierAt = (state: GameState, round: number): PowerTier | undefined =>
  state.powerTiers?.[POWER_CARD_ROUNDS.indexOf(round)];

export function offerPowerCards(state: GameState, p: Player): void {
  const tier = powerTierAt(state, state.round);
  if (!tier) return;
  p.powerOffer = { tier, cards: shuffle(state, Object.keys(POWER_CARDS)).slice(0, CARD_OFFER_SIZE), rerolled: [] };
}

// Swaps one offered power card for another not on offer. Each slot gets one reroll.
export function rerollPowerCard(state: GameState, p: Player, slot: number): string | null {
  const offer = p.powerOffer;
  if (!offer?.cards[slot]) return 'No card there';
  if (offer.rerolled[slot]) return 'That card was already rerolled';
  const pool = Object.keys(POWER_CARDS).filter((id) => !offer.cards.includes(id));
  if (pool.length === 0) return 'No other cards left';
  offer.cards[slot] = pool[nextInt(state, pool.length)];
  offer.rerolled[slot] = true;
  return null;
}

export function pickPowerCard(state: GameState, p: Player, id: string): string | null {
  if (!p.powerOffer?.cards.includes(id)) return 'That card is not on offer';
  const tier = p.powerOffer.tier;
  (p.powerCards ??= []).push({ id, tier });
  p.powerOffer = undefined;
  addXp(p, 0); // Fast Growth: already past the new, lower bar
  p.gold += POWER_CARDS[id].pickGold?.[tier] ?? 0;
  const orbChoices = POWER_CARDS[id].factionOrbChoices?.[tier];
  if (orbChoices) {
    const factions = shuffle(state, Object.values(TRAITS).filter((t) => t.kind === 'faction').map((t) => t.id)).slice(0, orbChoices);
    if (factions.length === 1) giveFactionOrb(state, p, factions[0]);
    else p.factionOrbOffer = factions;
  }
  p.freeRerolls = (p.freeRerolls ?? 0) + (POWER_CARDS[id].pickRerolls?.[tier] ?? 0);
  p.shield = (p.shield ?? 0) + (POWER_CARDS[id].pickShield?.[tier] ?? 0) || undefined;
  const luck = POWER_CARDS[id].lucky?.[tier];
  if (luck) p.gold += nextFloat(state) < 0.5 ? luck[0] : luck[1];
  const pay = POWER_CARDS[id].payday?.[tier];
  if (pay) {
    p.gold += pay.gold;
    (p.payday ??= []).push({ ...pay });
  }
  return null;
}

// Magic Surge: bonus mana per attack for a hero holding equipment (summed over the cards held).
export const attackManaOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].attackMana?.[c.tier] ?? 0), 0);

// Stat mods a fielded hero on board `cell`, holding `held` items and in `bigTraits` synergies of
// TEAMWORK_COUNT or more, gets from the power cards held (Breath of the Wild, Solid Front,
// Angel's Blessing, Sturdy Warrior, Fully Loaded, Teamwork).
export function powerMods(p: Player, cell: number, held: number, bigTraits: number): StatMod[] {
  const sum = (k: 'hybridLifesteal' | 'frontDef' | 'skillAmp' | 'sturdy' | 'loaded' | 'teamwork') => (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id][k]?.[c.tier] ?? 0), 0);
  const mods: StatMod[] = [];
  const steal = sum('hybridLifesteal');
  if (steal) mods.push({ stat: 'lifesteal', add: steal }, { stat: 'spellLifesteal', add: steal });
  const sturdy = sum('sturdy');
  if (sturdy) mods.push({ stat: 'hp', pct: sturdy }, { stat: 'atk', pct: sturdy }, { stat: 'ap', pct: sturdy });
  // Teamwork: once per synergy of the hero's at TEAMWORK_COUNT or more.
  const team = sum('teamwork') * bigTraits;
  if (team) mods.push({ stat: 'atk', pct: team }, { stat: 'ap', pct: team });
  const loaded = held >= MAX_ITEMS_PER_UNIT ? sum('loaded') : 0;
  if (loaded) mods.push({ stat: 'damageAmp', add: loaded });
  const amp = sum('skillAmp');
  if (amp) mods.push({ stat: 'skillAmp', add: amp });
  const def = cell < BOARD_COLS ? sum('frontDef') : 0; // row 0 is the front
  if (def) mods.push({ stat: 'armor', add: def }, { stat: 'mr', add: def });
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

// Fast Growth: the share less XP needed per level (the cards held add up).
export const xpCutOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].xpCut?.[c.tier] ?? 0), 0);

// Berserk: the share of starting attack gained each second (the cards held add up).
export const berserkOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].berserk?.[c.tier] ?? 0), 0);

// Kamikaze: the share of max hp a dying hero blasts around it (the cards held add up).
export const kamikazeOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].kamikaze?.[c.tier] ?? 0), 0);

// Sharpshooter: the share more damage per tile between (the cards held add up).
export const sharpshooterOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].sharpshooter?.[c.tier] ?? 0), 0);

// Healing Fountain: commander hp healed each round (the cards held add up).
export const roundHealOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].roundHeal?.[c.tier] ?? 0), 0);

// Mana Sovereign: the share of max mana back-row heroes start with (the cards held add up).
export const backManaOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].backMana?.[c.tier] ?? 0), 0);

// Angel's Blessing: the share of max mana back after each cast (the cards held add up).
export const castRefundOf = (p: Player): number =>
  (p.powerCards ?? []).reduce((n, c) => n + (POWER_CARDS[c.id].castRefund?.[c.tier] ?? 0), 0);

// Faction Synergy: a faction orb (a Mist orb) to the inventory, to put on a hero like an item.
function giveFactionOrb(state: GameState, p: Player, trait: string): void {
  (p.mistOrbs ??= []).push({ uid: state.nextUid++, trait, holder: null });
}

export function pickFactionOrb(state: GameState, p: Player, trait: string): string | null {
  if (!p.factionOrbOffer?.includes(trait)) return "That faction isn't on offer";
  p.factionOrbOffer = undefined;
  giveFactionOrb(state, p, trait);
  return null;
}
