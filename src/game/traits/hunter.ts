import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const HUNTER = {
  allyShred: [10, 25, 45], // armor and mr every ally's basic attack removes
  hunterBonus: [20, 45, 90], // extra on top for Hunters
};

export const hunter: TraitDef = {
  id: 'hunter',
  name: 'Hunter',
  icon: '🏹',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: "Allied attacks reduce the target's armor and magic resist by {ally}, Hunter attacks by {hunter}.",
  values: () => ({
    ally: HUNTER.allyShred.map(String),
    hunter: HUNTER.allyShred.map((n, i) => String(n + HUNTER.hunterBonus[i])),
  }),
  mods: ({ level, member }) => [
    { stat: 'armorShred', add: HUNTER.allyShred[level - 1] + (member ? HUNTER.hunterBonus[level - 1] : 0) },
  ],
};
