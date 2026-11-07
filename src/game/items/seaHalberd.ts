import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const SEA_HALBERD = {
  atk: 0.15, // + share of physical attack
  penetration: 25, // unique attribute: armor and mr its basic attacks remove (like Hunter)
  cut: 0.4, // Lifebane: healing the target receives
  seconds: 3,
};

export const seaHalberd: ItemDef = {
  id: 'seahalberd',
  name: 'Sea Halberd',
  icon: '🔱',
  kind: 'offense',
  group: 'physical',
  maxTier: 1,
  desc:
    `+${pct(SEA_HALBERD.atk)} physical attack. Unique attribute: basic attacks remove ${SEA_HALBERD.penetration} armor and magic resist (defense penetration). ` +
    `Lifebane (unique): dealing damage cuts the target's healing by ${pct(SEA_HALBERD.cut)} for ${SEA_HALBERD.seconds}s.`,
  values: () => ({}),
  mods: () => [{ stat: 'atk', pct: SEA_HALBERD.atk }],
  unique: () => [{ stat: 'armorShred', add: SEA_HALBERD.penetration }],
  lifebane: { cut: SEA_HALBERD.cut, seconds: SEA_HALBERD.seconds },
};
