import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (hybrid). Tune with `bun run balance`.
export const THIEF_TOOL = {
  hybridAtk: 0.1, // + share of attack and magic attack
  copies: 2, // Neat Pick: random equipment copied each fight
  slots: 3, // takes every item slot
};

export const thiefTool: ItemDef = {
  id: 'thieftool',
  name: 'Thief Tool',
  icon: '🗝️',
  kind: 'utility',
  group: 'hybrid',
  maxTier: 1,
  desc:
    `+${pct(THIEF_TOOL.hybridAtk)} attack and magic attack. Neat Pick (unique): when a fight starts, copies ${THIEF_TOOL.copies} random equipment ` +
    `from the equipment pool for that fight. Takes all ${THIEF_TOOL.slots} item slots (counts as ${THIEF_TOOL.slots} items).`,
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: THIEF_TOOL.hybridAtk },
    { stat: 'ap', pct: THIEF_TOOL.hybridAtk },
  ],
  slots: THIEF_TOOL.slots,
  copies: THIEF_TOOL.copies,
};
