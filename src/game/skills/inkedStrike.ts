import { empoweredAttack } from './empoweredAttack';

// Inkling (2g Storyweaver). Per star, index 0 = 1★.
export const INKED_STRIKE = {
  bonus: [0.8, 1, 1.6],
  heal: [0.1, 0.12, 0.2], // of its max hp
};

export const inkedStrike = empoweredAttack({ id: 'inkedstrike', name: 'Inked Strike', bonus: INKED_STRIKE.bonus, heal: INKED_STRIKE.heal });
