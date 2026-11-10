import { pct } from '../traits/format';
import { list, term } from './terms';
import type { CommanderDef, RallyPower } from './types';

// Tune with `bun run commanders`.
export const CYCLOPS = {
  rally: { hp: 80, heroes: 3, chests: 1 } satisfies RallyPower,
  heirShare: 0.14, // innate: of a knocked-out player's hero value, as gold
  card: { gold: 12, heirShare: 0.15 }, // on top of the innate share (29% in all on Cyclops)
};

const VALUE = term('heroValue', 'hero value');
const r = CYCLOPS.rally;

export const cyclops: CommanderDef = {
  id: 'cyclops',
  name: 'Cyclops',
  icon: '🧿',
  title: 'The Watchful Scavenger',
  desc:
    `The first time you drop to ${r.hp} HP or below, ${term('rally', 'rally')}: ${r.heroes} heroes of your biggest trait and ${r.chests} Equipment Chest. ` +
    `Whenever another commander is knocked out, gain ${pct(CYCLOPS.heirShare)} of their ${VALUE} as gold.`,
  innate: { rally: CYCLOPS.rally, heirShare: CYCLOPS.heirShare },
  card: {
    name: 'Carrion Feast',
    icon: '🍖',
    selfDesc:
      `Gain ${CYCLOPS.card.gold} gold now. Each knocked-out commander pays you another ${pct(CYCLOPS.card.heirShare)} of their ${VALUE} ` +
      `(${pct(CYCLOPS.heirShare + CYCLOPS.card.heirShare)} in all).`,
    self: { pickGold: CYCLOPS.card.gold, heirShareCard: CYCLOPS.card.heirShare },
    otherDesc: `Gain ${CYCLOPS.card.gold} gold now. Whenever another commander is knocked out, gain ${pct(CYCLOPS.card.heirShare)} of their ${VALUE} as gold.`,
    other: { pickGold: CYCLOPS.card.gold, heirShareCard: CYCLOPS.card.heirShare },
  },
  terms: {
    rally: {
      icon: '🧿',
      title: 'Rally',
      body: list(
        `Happens once: the first time a fight leaves you at ${r.hp} HP or below.`,
        'Your biggest trait is the one with the most fielded heroes (ties broken at random).',
        `The ${r.heroes} heroes come from the shared pool, at costs your shop can roll right now. They wait for bench room.`,
        'The Equipment Chest opens at the start of the next round.',
      ),
    },
    heroValue: {
      icon: '💰',
      title: 'Hero value',
      body: list(
        'Every copy of every hero they own, board and bench, at its shop price.',
        'A 2-star hero is 3 copies, a 3-star is 9.',
      ),
    },
  },
};
