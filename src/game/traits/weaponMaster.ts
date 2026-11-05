import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const WEAPON_MASTER = {
  lifesteal: [0.15, 0.2, 0.3], // hybrid (basic attacks and spells), every ally
  masterLifesteal: [0.15, 0.2, 0.25], // extra hybrid lifesteal for Weapon Masters
  masterAttack: [0.45, 0.55, 0.8], // attack for Weapon Masters
};

export const weaponMaster: TraitDef = {
  id: 'weaponmaster',
  name: 'Weapon Master',
  icon: '⚔️',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'All allies gain {lifesteal} hybrid lifesteal (basic attacks and spells). Weapon Masters gain {masters} and +{attack} attack.',
  values: () => ({
    lifesteal: WEAPON_MASTER.lifesteal.map(pct),
    masters: WEAPON_MASTER.lifesteal.map((l, i) => pct(l + WEAPON_MASTER.masterLifesteal[i])),
    attack: WEAPON_MASTER.masterAttack.map(pct),
  }),
  mods: ({ level, member }) => {
    const i = level - 1;
    const steal = WEAPON_MASTER.lifesteal[i] + (member ? WEAPON_MASTER.masterLifesteal[i] : 0);
    return [
      { stat: 'lifesteal', add: steal },
      { stat: 'spellLifesteal', add: steal },
      ...(member ? [{ stat: 'atk' as const, pct: WEAPON_MASTER.masterAttack[i] }] : []),
    ];
  },
};
