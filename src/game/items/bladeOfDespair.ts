import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const BLADE_OF_DESPAIR = {
  atk: 0.2, // + share of physical attack
  below: 0.5, // Despair: targets under this share of their max hp
  amp: 0.25,
  ampEnhanced: 0.5,
  seconds: 2,
};

const text = (amp: number) =>
  `+${pct(BLADE_OF_DESPAIR.atk)} physical attack. Despair (unique): hitting a target below ${pct(BLADE_OF_DESPAIR.below)} HP ` +
  `grants +${pct(amp)} damage for ${BLADE_OF_DESPAIR.seconds}s, that hit included.`;
const despair = (amp: number) => ({ effect: 'despair', below: BLADE_OF_DESPAIR.below, amp, seconds: BLADE_OF_DESPAIR.seconds });

export const bladeOfDespair: ItemDef = {
  id: 'bladeofdespair',
  name: 'Blade of Despair',
  icon: '🩸',
  kind: 'offense',
  group: 'physical',
  maxTier: 1,
  desc: text(BLADE_OF_DESPAIR.amp),
  values: () => ({}),
  mods: () => [{ stat: 'atk', pct: BLADE_OF_DESPAIR.atk }],
  lowHpFury: despair(BLADE_OF_DESPAIR.amp),
  enhanced: { desc: text(BLADE_OF_DESPAIR.ampEnhanced), lowHpFury: despair(BLADE_OF_DESPAIR.ampEnhanced) },
};
