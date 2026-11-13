import { pct } from '../traits/format';
import type { CableMarkPower, CommanderDef } from './types';

// Tune with `bun run balance`.
export const FANNY = {
  cable: { hybridAtk: 0.35 } satisfies CableMarkPower,
  card: { heroCap: 1, gold: 6 },
};

export const fanny: CommanderDef = {
  id: 'fanny',
  name: 'Fanny',
  icon: '🪢',
  title: 'Blade Dancer',
  desc:
    'Tie your steel cable to one hero (open a unit to pick it; move it freely, one hero at a time). ' +
    `It fights with +${pct(FANNY.cable.hybridAtk)} attack and magic attack, and takes no slot on the board.`,
  innate: { cable: FANNY.cable },
  card: {
    name: 'Steel Cable',
    icon: '🗡️',
    selfDesc: `Gain +${FANNY.card.heroCap} hero capacity and ${FANNY.card.gold} gold now.`,
    self: { heroCap: FANNY.card.heroCap, pickGold: FANNY.card.gold },
    // The same for anyone else (not the cable).
    otherDesc: `Gain +${FANNY.card.heroCap} hero capacity and ${FANNY.card.gold} gold now.`,
    other: { heroCap: FANNY.card.heroCap, pickGold: FANNY.card.gold },
  },
};
