import type { CommanderDef, TwilightPower } from './types';

// Tune with `bun run balance`.
export const LUNOX = {
  twilight: { heroes: 2, gold: 4 } satisfies TwilightPower,
  // On another commander: the blessing and more gold, but no heroes.
  other: { heroes: 0, gold: 12 } satisfies TwilightPower,
  // His card: the first time the blessed trait reaches 6, this much gold.
  twilightGold: { count: 6, gold: 18 },
  cardGold: 8, // on Lunox, when the card is picked
};

const t = LUNOX.twilight;

export const lunox: CommanderDef = {
  id: 'lunox',
  name: 'Lunox',
  icon: '🌗',
  title: 'Herald of Twilight',
  desc:
    `Starts with ${t.gold} gold and a Twilight Blessing. Bless one of your heroes: one of its own ` +
    'traits is rolled at random, and that hero counts +1 toward it while fielded (stacking with the Magic Orb). ' +
    `You also get ${t.heroes} random heroes of that trait, their costs rolled with your current shop odds. ` +
    "The blessing stays with that very hero: sell it and it's gone.",
  innate: { twilight: LUNOX.twilight },
  card: {
    name: 'Eclipse',
    icon: '🌌',
    selfDesc: `Gain ${LUNOX.cardGold} gold now. The first time your blessed trait reaches ${LUNOX.twilightGold.count} on your board, gain ${LUNOX.twilightGold.gold} gold.`,
    self: { twilightGold: LUNOX.twilightGold, pickGold: LUNOX.cardGold },
    otherDesc:
      `Gain ${LUNOX.other.gold} gold and a Twilight Blessing: bless one of your heroes, and it counts +1 toward one of its own traits, ` +
      'rolled at random, while fielded (stacking with the Magic Orb). It stays with that very hero: sell it and it\'s gone.',
    other: { twilight: LUNOX.other },
  },
};
