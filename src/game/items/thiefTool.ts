import { pct } from '../traits/format';
import type { EquipmentGroup, ItemDef } from './types';

// Equipment (hybrid). Tune with `bun run balance`.
export const THIEF_TOOL = {
  hybridAtk: 0.1, // + share of attack and magic attack
  // Neat Pick: equipment copied each fight, one from each list, by the holder's attack type.
  copies: {
    physical: [['physical'], ['armor']],
    magic: [['magic', 'hybrid'], ['armor']],
  } satisfies Record<'physical' | 'magic', EquipmentGroup[][]>,
  slots: 3, // takes every item slot
  damageEnhanced: 0.15, // enhanced: + damage dealt
};

const text = (dmg = 0) =>
  `+${pct(THIEF_TOOL.hybridAtk)} attack and magic attack${dmg ? `, +${pct(dmg)} damage` : ''}. Neat Pick (unique): when a fight starts, copies 2 random equipment for that fight, suited to its holder: ` +
  `a physical attacker gets 1 physical item and 1 armor, a magic attacker 1 magic or hybrid item and 1 armor. Takes all ${THIEF_TOOL.slots} item slots (counts as ${THIEF_TOOL.slots} items).`;
const hybrid = [
  { stat: 'atk' as const, pct: THIEF_TOOL.hybridAtk },
  { stat: 'ap' as const, pct: THIEF_TOOL.hybridAtk },
];

export const thiefTool: ItemDef = {
  id: 'thieftool',
  name: 'Thief Tool',
  icon: '🗝️',
  kind: 'utility',
  group: 'hybrid',
  maxTier: 1,
  desc: text(),
  values: () => ({}),
  mods: () => hybrid,
  slots: THIEF_TOOL.slots,
  copies: THIEF_TOOL.copies,
  enhanced: { desc: text(THIEF_TOOL.damageEnhanced), mods: () => [...hybrid, { stat: 'damageAmp', add: THIEF_TOOL.damageEnhanced }] },
};
