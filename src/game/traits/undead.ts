import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const UNDEAD = {
  allyShred: [20, 30, 45], // armor and mr every ally's basic attack removes
  undeadBonus: [50, 60, 90], // extra on top for Undead
};

export const undead: TraitDef = {
  id: 'undead',
  name: 'Undead',
  icon: '💀',
  kind: 'faction',
  breakpoints: [2, 4, 6],
  desc: "Allied attacks reduce the target's armor and magic resist by {ally}, Undead attacks by {undead}.",
  values: () => ({
    ally: UNDEAD.allyShred.map(String),
    undead: UNDEAD.allyShred.map((n, i) => String(n + UNDEAD.undeadBonus[i])),
  }),
  mods: ({ level, member }) => [
    { stat: 'armorShred', add: UNDEAD.allyShred[level - 1] + (member ? UNDEAD.undeadBonus[level - 1] : 0) },
  ],
};
