import { empoweredAttack } from './empoweredAttack';

// Banshee (2g Hunter). Per star, index 0 = 1★.
export const MOURNFUL_SHOT = {
  bonus: [1.5, 1.75, 2.75],
};

export const mournfulShot = empoweredAttack({ id: 'mournfulshot', name: 'Mournful Shot', bonus: MOURNFUL_SHOT.bonus });
