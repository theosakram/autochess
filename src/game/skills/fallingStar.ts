import { dashStrike } from './dashStrike';

// Nebula Seer (3g Hunter). Per star, index 0 = 1★.
export const FALLING_STAR = {
  ap: [6.5, 7.5, 15], // of magic attack, as magic damage
};

export const fallingStar = dashStrike({ id: 'fallingstar', name: 'Falling Star', target: 'weakest', scale: FALLING_STAR.ap, stat: 'ap', type: 'magic' });
