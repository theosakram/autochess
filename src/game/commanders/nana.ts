import type { CommanderDef, HurtGoldPower } from './types';

// Tune with `bun run balance`.
export const NANA = {
  hurtGold: { every: 10, gold: 10, times: 3, chest: true } satisfies HurtGoldPower,
  deathSaves: { innate: 1, card: 2 },
  card: { gold: 8, chests: 1 },
};

const g = NANA.hurtGold;

export const nana: CommanderDef = {
  id: 'nana',
  name: 'Nana',
  icon: '🦝',
  title: 'Tanuki Trickster',
  desc:
    'The first time you would be knocked out, you survive with 1 HP instead. ' +
    `Every ${g.every} damage you take pays ${g.gold} gold, up to ${g.times} times; the last one also gives an Equipment Chest.`,
  innate: { deathSaves: NANA.deathSaves.innate, hurtGold: NANA.hurtGold },
  card: {
    name: 'Leaf Disguise',
    icon: '🍃',
    selfDesc: `Gain an Equipment Chest and ${NANA.card.gold} gold now. You survive being knocked out one more time: twice in all.`,
    self: { deathSaves: NANA.deathSaves.card, pickGold: NANA.card.gold, pickChest: NANA.card.chests },
  },
};
