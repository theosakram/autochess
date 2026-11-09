import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Per tier; the tier is the Cult of Fire level, so index 0 = Cult of Fire 2.
export const OFFERING = {
  share: [0.15, 0.25, 0.5, 1], // of the holder's attack, added to every Cult of Fire unit
  hybridAtk: 0.25, // the holder: + share of attack and magic attack
  hpEnhanced: 0.15, // enhanced: + share of the holder's max hp
};

const text = (hp = 0) =>
  `+${pct(OFFERING.hybridAtk)} attack and magic attack${hp ? `, +${pct(hp)} max HP` : ''}. Only for units outside the cult. Every Cult of Fire unit gains {share} of the holder's attack or magic attack, whichever is higher, as both. ` +
  'The holder gets the Cult of Fire unit bonus, without counting toward the cult.';

const hybrid = [
  { stat: 'atk' as const, pct: OFFERING.hybridAtk },
  { stat: 'ap' as const, pct: OFFERING.hybridAtk },
];

export const offering: ItemDef = {
  id: 'offering',
  name: 'Pyre Offering',
  icon: '🕯️',
  kind: 'utility',
  trait: 'cultoffire',
  maxTier: 4,
  tierFromTrait: true,
  forbidden: 'cultoffire',
  desc: text(),
  values: () => ({ share: OFFERING.share.map(pct) }),
  mods: () => hybrid,
  aura: (tier) => ({ to: 'cultoffire', from: ['atk', 'ap'], stats: ['atk', 'ap'], share: OFFERING.share[tier - 1] }),
  grantsMembership: { trait: 'cultoffire', icon: '♨️' },
  enhanced: { desc: text(OFFERING.hpEnhanced), mods: () => [...hybrid, { stat: 'hp', pct: OFFERING.hpEnhanced }] },
};
