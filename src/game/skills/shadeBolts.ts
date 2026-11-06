import { barrage } from './barrage';

// Shadewalker (2g Phasewarper). Per star, index 0 = 1★.
export const SHADE_BOLTS = { hits: 3, every: 0.7, atk: [1.2, 1.4, 2.5] };

export const shadeBolts = barrage({
  id: 'shadebolts',
  name: 'Shade Bolts',
  hits: SHADE_BOLTS.hits,
  every: SHADE_BOLTS.every,
  scale: SHADE_BOLTS.atk,
  stat: 'atk',
  type: 'physical',
  busy: false,
  projectile: true,
});
