import { barrage } from './barrage';

// Storm Herald (3g Phasewarper). Per star, index 0 = 1★.
export const STORM_FLURRY = { hits: 5, every: 0.1, ap: [0.7, 0.85, 1.7] };

export const stormFlurry = barrage({
  id: 'stormflurry',
  name: 'Storm Flurry',
  hits: STORM_FLURRY.hits,
  every: STORM_FLURRY.every,
  scale: STORM_FLURRY.ap,
  stat: 'ap',
  type: 'magic',
  busy: true,
  projectile: false,
});
