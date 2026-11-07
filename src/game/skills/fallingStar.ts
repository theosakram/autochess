import { dashStrike } from './dashStrike';

// Katarina (3g Astral / Stargazer / Hunter). Per star, index 0 = 1★.
export const FALLING_STAR = {
  ap: [4.4, 4.5, 5], // of magic attack, as magic damage
};

export const fallingStar = dashStrike({ id: 'fallingstar', name: 'Falling Star', target: 'farthest', scale: FALLING_STAR.ap, stat: 'ap', type: 'magic', area: true });
