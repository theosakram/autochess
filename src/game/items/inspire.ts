import { pct } from '../traits/format';
import { PASSIVES, withPassives } from './passives';
import type { ItemDef } from './types';

// Basic item. Per stage (tier), index 0 = stage I. Tune with `bun run balance`.
export const INSPIRE = {
  attackSpeed: [0.2, 0.3, 0.4, 0.5],
};

export const inspire: ItemDef = {
  id: 'inspire',
  name: 'Inspire',
  icon: '🎺',
  kind: 'utility',
  maxTier: INSPIRE.attackSpeed.length,
  basic: true,
  tierByStage: true,
  desc: 'Inspire (unique): +{as} attack speed. Grows every stage (I / II / III / IV+: 20% / 30% / 40% / 50%).',
  values: () => ({ as: INSPIRE.attackSpeed.map(pct) }),
  mods: () => [],
  unique: (tier) => [{ stat: 'attackSpeed', add: INSPIRE.attackSpeed[tier - 1] }],
};
inspire.enhanced = withPassives(inspire, PASSIVES.swift);

