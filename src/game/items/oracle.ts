import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const ORACLE = {
  defense: 30, // armor and magic resist each, on the holder
  rowDefense: 20, // Resist: armor and magic resist each, for every other ally in its row
};

export const oracle: ItemDef = {
  id: 'oracle',
  name: 'Oracle',
  icon: '🧿',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc:
    `+${ORACLE.defense} armor and magic resist. ` +
    `Resist (unique): when a fight starts, every other ally in the holder's row gains +${ORACLE.rowDefense} armor and magic resist for the fight.`,
  values: () => ({}),
  mods: () => [
    { stat: 'armor', add: ORACLE.defense },
    { stat: 'mr', add: ORACLE.defense },
  ],
  rowBuff: { effect: 'resist', mods: [{ stat: 'armor', add: ORACLE.rowDefense }, { stat: 'mr', add: ORACLE.rowDefense }] },
};
