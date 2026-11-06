import { empoweredAttack } from './empoweredAttack';

// Dwarapala (2g Mooneater): the temple guardian. Per star, index 0 = 1★.
export const GUARDIANS_STRIKE = {
  bonus: [1, 1.25, 2],
  shield: [150, 250, 600], // flat
  seconds: 4,
};

export const guardiansStrike = empoweredAttack({
  id: 'guardiansstrike',
  name: "Guardian's Strike",
  bonus: GUARDIANS_STRIKE.bonus,
  shield: { amount: GUARDIANS_STRIKE.shield, seconds: GUARDIANS_STRIKE.seconds },
});
