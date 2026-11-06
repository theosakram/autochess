import { empoweredAttack } from './empoweredAttack';

// Wisp (1g Scavenger). Per star, index 0 = 1★.
export const SAPPING_TOUCH = {
  bonus: [1, 1.25, 2],
  weaken: [0.2, 0.25, 0.4], // of the target's attack and magic attack
  seconds: 4,
};

export const sappingTouch = empoweredAttack({
  id: 'sappingtouch',
  name: 'Sapping Touch',
  bonus: SAPPING_TOUCH.bonus,
  weaken: { share: SAPPING_TOUCH.weaken, seconds: SAPPING_TOUCH.seconds },
});
