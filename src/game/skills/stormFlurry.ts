import { barrage } from './barrage';

// Clint (3g Skybringer / Phasewarper): 5 rapid shots. Skill hits, not basic attacks: no on-hit item effects.
// Per star, index 0 = 1★.
export const STORM_FLURRY = { hits: 5, every: 0.1, atk: [1.25, 1.25, 2] };

export const stormFlurry = barrage({
  id: 'stormflurry',
  name: 'Storm Flurry',
  hits: STORM_FLURRY.hits,
  every: STORM_FLURRY.every,
  scale: STORM_FLURRY.atk,
  stat: 'atk',
  type: 'physical',
  busy: true,
  projectile: true,
});
