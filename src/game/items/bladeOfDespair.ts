import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const BLADE_OF_DESPAIR = {
  atk: 0.2, // + share of physical attack
  below: 0.5, // Despair: targets under this share of their max hp
  amp: 0.25,
  seconds: 2,
};

export const bladeOfDespair: ItemDef = {
  id: 'bladeofdespair',
  name: 'Blade of Despair',
  icon: '🩸',
  kind: 'offense',
  maxTier: 1,
  desc:
    `+${pct(BLADE_OF_DESPAIR.atk)} physical attack. Despair (unique): hitting a target below ${pct(BLADE_OF_DESPAIR.below)} HP ` +
    `grants +${pct(BLADE_OF_DESPAIR.amp)} damage for ${BLADE_OF_DESPAIR.seconds}s, that hit included.`,
  values: () => ({}),
  mods: () => [{ stat: 'atk', pct: BLADE_OF_DESPAIR.atk }],
  lowHpFury: { effect: 'despair', below: BLADE_OF_DESPAIR.below, amp: BLADE_OF_DESPAIR.amp, seconds: BLADE_OF_DESPAIR.seconds },
};
