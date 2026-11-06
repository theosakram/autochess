import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (magic). Tune with `bun run balance`.
export const DIVINE_GLAIVE = {
  ap: 0.25, // + share of magic attack
  magicPen: 0.35, // unique attribute: share of the target's magic resist ignored
};

export const divineGlaive: ItemDef = {
  id: 'divineglaive',
  name: 'Divine Glaive',
  icon: '🌙',
  kind: 'offense',
  maxTier: 1,
  desc: `+${pct(DIVINE_GLAIVE.ap)} magic attack. Unique attribute: +${pct(DIVINE_GLAIVE.magicPen)} magic penetration (its magic damage ignores that much of the target's magic resist).`,
  values: () => ({}),
  mods: () => [{ stat: 'ap', pct: DIVINE_GLAIVE.ap }],
  unique: () => [{ stat: 'magicPen', add: DIVINE_GLAIVE.magicPen }],
};
