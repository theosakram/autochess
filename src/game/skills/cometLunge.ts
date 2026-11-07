import { empoweredAttack } from './empoweredAttack';

// Martin (2g Astral / Weapon Master). Per star, index 0 = 1★.
export const COMET_LUNGE = {
  bonus: [3, 3, 4], // extra on top of a normal attack: 400% / 400% / 500% of attack in all
  shield: [0.1, 0.1, 0.1], // of its max hp
  seconds: 4,
};

export const cometLunge = empoweredAttack({
  id: 'cometlunge',
  name: 'Comet Lunge',
  bonus: COMET_LUNGE.bonus,
  shieldHp: { share: COMET_LUNGE.shield, seconds: COMET_LUNGE.seconds },
});
