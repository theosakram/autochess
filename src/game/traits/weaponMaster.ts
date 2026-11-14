import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
// The team gets attack (like Mage's magic attack); Weapon Masters land a Masterstroke every few basic
// attacks: a big hit through part of the target's defense that heals them for a share of it.
export const WEAPON_MASTER = {
  attack: [0.1, 0.2, 0.3], // attack, every ally
  every: 3, // every 3rd basic attack of a Weapon Master is a Masterstroke
  damage: [0.5, 1, 2], // a Masterstroke's extra damage
  pen: [0.2, 0.35, 0.5], // share of armor and magic resist it ignores
  steal: [0.4, 0.6, 1], // share of its damage it heals back
};

export const weaponMaster: TraitDef = {
  id: 'weaponmaster',
  name: 'Weapon Master',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc:
    `All allies gain +{attack} attack. Every ${WEAPON_MASTER.every}rd basic attack of a Weapon Master is a Masterstroke: ` +
    '+{damage} damage, ignoring {pen} of armor and magic resist, and it heals them for {steal} of the damage dealt.',
  values: () => ({
    attack: WEAPON_MASTER.attack.map(pct),
    damage: WEAPON_MASTER.damage.map(pct),
    pen: WEAPON_MASTER.pen.map(pct),
    steal: WEAPON_MASTER.steal.map(pct),
  }),
  mods: ({ level, member }) => {
    const i = level - 1;
    return [
      { stat: 'atk', pct: WEAPON_MASTER.attack[i] },
      ...(member
        ? [
            { stat: 'masterstroke' as const, add: WEAPON_MASTER.damage[i] },
            { stat: 'masterPen' as const, add: WEAPON_MASTER.pen[i] },
            { stat: 'masterSteal' as const, add: WEAPON_MASTER.steal[i] },
          ]
        : []),
    ];
  },
};
