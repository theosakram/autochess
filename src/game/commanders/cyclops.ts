import { pct } from '../traits/format';
import type { CommanderDef, RallyPower } from './types';

// Tune with `bun run commanders`.
export const CYCLOPS = {
  rally: { hp: 80, heroes: 3, chests: 1 } satisfies RallyPower,
  heirShare: 0.14, // innate: of a knocked-out player's hero value, as gold
  card: { gold: 12, heirShare: 0.15 }, // on top of the innate share (29% in all on Cyclops)
};

const cardDesc =
  `Gain ${CYCLOPS.card.gold} gold now. Whenever another commander is knocked out, gain ${pct(CYCLOPS.card.heirShare)} ` +
  'of the value of their heroes (board and bench) as gold.';

export const cyclops: CommanderDef = {
  id: 'cyclops',
  name: 'Cyclops',
  icon: '🧿',
  title: 'The Watchful Scavenger',
  desc:
    `The first time you drop to ${CYCLOPS.rally.hp} HP or below, gain ${CYCLOPS.rally.heroes} random heroes of your biggest trait ` +
    `(the one with the most fielded heroes) and ${CYCLOPS.rally.chests} Equipment Chest. ` +
    `Whenever another commander is knocked out, gain ${pct(CYCLOPS.heirShare)} of the value of their heroes (board and bench) as gold.`,
  innate: { rally: CYCLOPS.rally, heirShare: CYCLOPS.heirShare },
  card: {
    name: 'Carrion Feast',
    icon: '🍖',
    selfDesc: `${cardDesc} Stacks with your own: ${pct(CYCLOPS.heirShare + CYCLOPS.card.heirShare)} in all.`,
    self: { pickGold: CYCLOPS.card.gold, heirShareCard: CYCLOPS.card.heirShare },
    otherDesc: cardDesc,
    other: { pickGold: CYCLOPS.card.gold, heirShareCard: CYCLOPS.card.heirShare },
  },
};
