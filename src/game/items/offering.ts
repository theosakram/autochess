import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Per tier; the tier is the Cult of Fire level, so index 0 = Cult of Fire 2.
export const OFFERING = {
  share: [0.25, 0.4, 0.6, 1.25], // of the holder's attack, added to every Cult of Fire unit
};

export const offering: ItemDef = {
  id: 'offering',
  name: 'Pyre Offering',
  icon: '🕯️',
  kind: 'utility',
  trait: 'cultoffire',
  maxTier: 4,
  tierFromTrait: true,
  forbidden: 'cultoffire',
  desc:
    "Only for units outside the cult. Every Cult of Fire unit gains {share} of the holder's attack or magic attack, whichever is higher, as both. " +
    'The holder gets the Cult of Fire unit bonus, without counting toward the cult.',
  values: () => ({ share: OFFERING.share.map(pct) }),
  mods: () => [],
  aura: (tier) => ({ to: 'cultoffire', from: ['atk', 'ap'], stats: ['atk', 'ap'], share: OFFERING.share[tier - 1] }),
  grantsMembership: { trait: 'cultoffire', icon: '♨️' },
};
