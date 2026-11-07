import { empoweredAttack } from './empoweredAttack';

// Phove (1g Spectre / Scavenger). Per star, index 0 = 1★.
export const SAPPING_TOUCH = {
  bonus: [3.9, 3.9, 5.85], // on top of the attack itself: the enhanced attack deals 490 / 490 / 685%
  weaken: [0.1, 0.1, 0.12], // of the target's attack and magic attack
  seconds: 4,
};

export const sappingTouch = empoweredAttack({
  id: 'sappingtouch',
  name: 'Sapping Touch',
  bonus: SAPPING_TOUCH.bonus,
  weaken: { share: SAPPING_TOUCH.weaken, seconds: SAPPING_TOUCH.seconds },
});
