import { dashStrike } from './dashStrike';

// Tempest Knight (4g Hunter): the carry killer. Per star, index 0 = 1★.
export const STORM_PURSUIT = {
  atk: [9, 11, 26], // of attack, as physical damage
};

export const stormPursuit = dashStrike({
  id: 'stormpursuit',
  name: 'Storm Pursuit',
  target: 'deadliest',
  scale: STORM_PURSUIT.atk,
  stat: 'atk',
  type: 'physical',
});
