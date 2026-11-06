import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (magic). Tune with `bun run balance`.
export const GLOWING_WAND = {
  ap: 0.15, // + share of magic attack
  burn: 0.025, // Scorch: of the target's max hp, magic, per second
  min: 10, // per second
  seconds: 3,
  cut: 0.3, // healing the target receives, while burning
};

export const glowingWand: ItemDef = {
  id: 'glowingwand',
  name: 'Glowing Wand',
  icon: '🔆',
  kind: 'offense',
  maxTier: 1,
  desc:
    `+${pct(GLOWING_WAND.ap)} magic attack. Scorch (unique): skill damage burns the target for ${GLOWING_WAND.seconds}s, ` +
    `dealing ${pct(GLOWING_WAND.burn)} of its max HP (at least ${GLOWING_WAND.min}) as magic damage every second, ` +
    `and cuts its healing by ${pct(GLOWING_WAND.cut)} for ${GLOWING_WAND.seconds}s.`,
  values: () => ({}),
  mods: () => [{ stat: 'ap', pct: GLOWING_WAND.ap }],
  scorch: { effect: 'scorch', share: GLOWING_WAND.burn, min: GLOWING_WAND.min, seconds: GLOWING_WAND.seconds, cut: GLOWING_WAND.cut },
};
