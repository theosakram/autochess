import { empoweredAttack } from './empoweredAttack';

// Comet Lancer (2g Weapon Master). Per star, index 0 = 1★.
export const COMET_LUNGE = {
  bonus: [1, 1.25, 2],
  lifesteal: [0.5, 0.6, 1], // of the lunge's damage
  shield: [0.15, 0.2, 0.35], // of its max hp
  seconds: 4,
};

export const cometLunge = empoweredAttack({
  id: 'cometlunge',
  name: 'Comet Lunge',
  bonus: COMET_LUNGE.bonus,
  lifesteal: COMET_LUNGE.lifesteal,
  shieldHp: { share: COMET_LUNGE.shield, seconds: COMET_LUNGE.seconds },
});
