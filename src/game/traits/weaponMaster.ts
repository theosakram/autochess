import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
// Small at 2, clearly more at 4 and 6: going deeper is what pays.
export const WEAPON_MASTER = {
  lifesteal: [0.05, 0.1, 0.15], // hybrid (basic attacks and spells), every ally
  memberLifestealMult: 2, // Weapon Masters get this many times the ally lifesteal
  attack: [0.4, 0.6, 1.2], // attack, Weapon Masters only
};

export const weaponMaster: TraitDef = {
  id: 'weaponmaster',
  name: 'Weapon Master',
  icon: '⚔️',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc:
    'All allies gain {lifesteal} hybrid lifesteal (basic attacks and spells). ' +
    'Weapon Masters get {masterLifesteal} instead, and +{attack} attack.',
  values: () => ({
    lifesteal: WEAPON_MASTER.lifesteal.map(pct),
    masterLifesteal: WEAPON_MASTER.lifesteal.map((l) => pct(l * WEAPON_MASTER.memberLifestealMult)),
    attack: WEAPON_MASTER.attack.map(pct),
  }),
  mods: ({ level, member }) => {
    const i = level - 1;
    const steal = WEAPON_MASTER.lifesteal[i] * (member ? WEAPON_MASTER.memberLifestealMult : 1);
    return [
      { stat: 'lifesteal', add: steal },
      { stat: 'spellLifesteal', add: steal },
      ...(member ? [{ stat: 'atk' as const, pct: WEAPON_MASTER.attack[i] }] : []),
    ];
  },
};
