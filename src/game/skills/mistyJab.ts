import { empoweredAttack } from './empoweredAttack';

// Fogfist (3g Mistbender): a cheap jab to spam for Mist coins. Per star, index 0 = 1★.
export const MISTY_JAB = {
  bonus: [0.4, 0.5, 0.9],
  heal: [0.06, 0.08, 0.14], // of its max hp
};

export const mistyJab = empoweredAttack({ id: 'mistyjab', name: 'Misty Jab', bonus: MISTY_JAB.bonus, heal: MISTY_JAB.heal });
