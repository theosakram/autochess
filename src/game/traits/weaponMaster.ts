import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
// Small at 2, clearly more at 4 and 6: going deeper is what pays.
export const WEAPON_MASTER = {
  lifesteal: [0.1, 0.2, 0.3], // hybrid (basic attacks and spells), Weapon Masters only
  attack: [0.25, 0.45, 0.75], // attack, Weapon Masters only
};

export const weaponMaster: TraitDef = {
  id: 'weaponmaster',
  name: 'Weapon Master',
  icon: '⚔️',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'Weapon Masters gain {lifesteal} hybrid lifesteal (basic attacks and spells) and +{attack} attack.',
  values: () => ({
    lifesteal: WEAPON_MASTER.lifesteal.map(pct),
    attack: WEAPON_MASTER.attack.map(pct),
  }),
  mods: ({ level, member }) => {
    if (!member) return [];
    const i = level - 1;
    return [
      { stat: 'lifesteal', add: WEAPON_MASTER.lifesteal[i] },
      { stat: 'spellLifesteal', add: WEAPON_MASTER.lifesteal[i] },
      { stat: 'atk', pct: WEAPON_MASTER.attack[i] },
    ];
  },
};
