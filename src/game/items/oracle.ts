import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const ORACLE = {
  defense: 20, // armor and magic resist each, on the holder
  rowDefense: 20, // Magic Resist: armor and magic resist each, for every ally in its row, the holder included
  hpEnhanced: 0.06, // enhanced: Magic Resist also gives this share of max hp
};

const resist = (hp: number) =>
  `Magic Resist (unique): when a fight starts, every ally in the holder's row (the holder too) gains +${ORACLE.rowDefense} armor and magic resist` +
  `${hp ? ` and +${hp * 100}% max HP` : ''} for the fight.`;
const rowDefense = [
  { stat: 'armor' as const, add: ORACLE.rowDefense },
  { stat: 'mr' as const, add: ORACLE.rowDefense },
];

export const oracle: ItemDef = {
  id: 'oracle',
  name: 'Oracle',
  icon: '🧿',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc: `+${ORACLE.defense} armor and magic resist. ${resist(0)}`,
  values: () => ({}),
  mods: () => [
    { stat: 'armor', add: ORACLE.defense },
    { stat: 'mr', add: ORACLE.defense },
  ],
  rowBuff: { effect: 'resist', mods: rowDefense },
  enhanced: {
    desc: `+${ORACLE.defense} armor and magic resist. ${resist(ORACLE.hpEnhanced)}`,
    rowBuff: { effect: 'resist', mods: rowDefense, hpPct: ORACLE.hpEnhanced },
  },
};
