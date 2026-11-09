import { pct } from '../traits/format';
import { PASSIVES, withPassives } from './passives';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const SEA_HALBERD = {
  atk: 0.15, // + share of physical attack
  armorPen: 0.4, // unique attribute: share of the target's armor its physical damage ignores
  cut: 0.4, // Lifebane: healing the target receives
  seconds: 5,
};

export const seaHalberd: ItemDef = {
  id: 'seahalberd',
  name: 'Sea Halberd',
  icon: '🔱',
  kind: 'offense',
  group: 'physical',
  maxTier: 1,
  desc:
    `+${pct(SEA_HALBERD.atk)} physical attack. Unique attribute: +${pct(SEA_HALBERD.armorPen)} physical penetration (its physical damage ignores that share of armor). ` +
    `Lifebane (unique): dealing damage cuts the target's healing by ${pct(SEA_HALBERD.cut)} for ${SEA_HALBERD.seconds}s.`,
  values: () => ({}),
  mods: () => [{ stat: 'atk', pct: SEA_HALBERD.atk }],
  unique: () => [{ stat: 'armorPen', add: SEA_HALBERD.armorPen }],
  lifebane: { cut: SEA_HALBERD.cut, seconds: SEA_HALBERD.seconds },
};
seaHalberd.enhanced = withPassives(seaHalberd, PASSIVES.pierce);

