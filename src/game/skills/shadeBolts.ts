import { barrage } from './barrage';

// Harley (2g Necromancer / Phasewarper). Per star, index 0 = 1★.
export const SHADE_BOLTS = { hits: 3, every: 0.7, ap: [0.9, 0.9, 1.25] };

export const shadeBolts = barrage({
  id: 'shadebolts',
  name: 'Shade Bolts',
  hits: SHADE_BOLTS.hits,
  every: SHADE_BOLTS.every,
  scale: SHADE_BOLTS.ap,
  stat: 'ap',
  type: 'magic',
  busy: false,
  projectile: true,
});
