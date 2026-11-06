import { empoweredAttack } from './empoweredAttack';

// Myth Beast (Storyweaver's Myth Made Flesh summon; star = its summoner's). Per star, index 0 = 1★.
export const BEAST_MAUL = {
  bonus: [1.2, 1.5, 2.5],
};

export const beastMaul = empoweredAttack({ id: 'beastmaul', name: 'Beast Maul', bonus: BEAST_MAUL.bonus });
