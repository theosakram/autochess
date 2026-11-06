import { pct } from '../traits/format';
import type { BoostPower, CommanderDef, WardPower } from './types';

// Tune with `bun run balance`.
export const KAGURA = {
  ward: { below: 0.5, shield: 1.25 } satisfies WardPower,
  boost: { hybridAtk: 0.3, hybridLifesteal: 0.2 } satisfies BoostPower,
  gold: 10,
};

export const kagura: CommanderDef = {
  id: 'kagura',
  name: 'Kagura',
  icon: '☂️',
  title: 'Mistress of the Umbrella',
  desc:
    'During preparation, mark one hero with your umbrella (open a unit to pick it). ' +
    `The first time it drops below ${pct(KAGURA.ward.below)} HP in a fight, it gains a shield worth ${pct(KAGURA.ward.shield)} of its max HP for the rest of the fight.`,
  innate: { ward: KAGURA.ward },
  card: {
    name: 'Umbrella Dance',
    icon: '🌂',
    selfDesc:
      `Gain ${KAGURA.gold} gold now. Mark a hero to dance with (the umbrella hero or another one): it fights with ` +
      `+${pct(KAGURA.boost.hybridAtk)} attack and magic attack and ${pct(KAGURA.boost.hybridLifesteal)} hybrid lifesteal (basic attacks and spells).`,
    self: { boost: KAGURA.boost, pickGold: KAGURA.gold },
  },
};
