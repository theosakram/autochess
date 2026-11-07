import type { ItemDef } from './types';

// Luo Yi's Essence Core (see essence.ts): what it gives depends on the hero on her altar, so its stats are
// worked out there (essenceMods) rather than here. It exists while a hero is on the altar.
export const ESSENCE_CORE = 'essencecore';

export const essenceCore: ItemDef = {
  id: ESSENCE_CORE,
  name: 'Essence Core',
  icon: '🔶',
  kind: 'utility',
  maxTier: 1,
  exclusive: true,
  desc:
    "Holds the essence of the hero on Luo Yi's altar: a share of its stats and its items' stats, and an Enhancement Effect for each of its roles. Only from Commander Luo Yi.",
  values: () => ({}),
  mods: () => [],
};
