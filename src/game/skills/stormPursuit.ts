import { dashStrike } from './dashStrike';

// Tempest Knight (4g Hunter): the carry killer. Per star, index 0 = 1★.
export const STORM_PURSUIT = {
  ap: [9, 11, 26], // of magic attack, as magic damage
};

export const stormPursuit = dashStrike({
  id: 'stormpursuit',
  name: 'Storm Pursuit',
  target: 'deadliest',
  scale: STORM_PURSUIT.ap,
  stat: 'ap',
  type: 'magic',
});
