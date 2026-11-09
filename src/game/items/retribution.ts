import { pct } from '../traits/format';
import { PASSIVES, withPassives } from './passives';
import type { ItemDef } from './types';

// Basic item. Per stage (tier), index 0 = stage I. Tune with `bun run balance`.
export const RETRIBUTION = {
  damage: [0.2, 0.3, 0.4, 0.5],
};

export const retribution: ItemDef = {
  id: 'retribution',
  name: 'Retribution',
  icon: '⚔️',
  kind: 'offense',
  maxTier: RETRIBUTION.damage.length,
  basic: true,
  tierByStage: true,
  desc: 'Retribution (unique): +{dmg} damage. Grows every stage (I / II / III / IV+: 20% / 30% / 40% / 50%).',
  values: () => ({ dmg: RETRIBUTION.damage.map(pct) }),
  mods: () => [],
  unique: (tier) => [{ stat: 'damageAmp', add: RETRIBUTION.damage[tier - 1] }],
};
retribution.enhanced = withPassives(retribution, PASSIVES.onslaught);

