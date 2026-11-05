import { empoweredAttack } from './empoweredAttack';

// Drakeling (1g Hunter). Per star, index 0 = 1★.
export const RENDING_BITE = {
  bonus: [1, 1.25, 2],
  defense: [20, 30, 50],
  seconds: 4,
};

export const rendingBite = empoweredAttack({
  id: 'rendingbite',
  name: 'Rending Bite',
  bonus: RENDING_BITE.bonus,
  tear: { defense: RENDING_BITE.defense, seconds: RENDING_BITE.seconds },
});
