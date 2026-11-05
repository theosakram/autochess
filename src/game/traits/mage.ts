import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const MAGE = {
  allies: [0.1, 0.2, 0.3], // magic attack for every ally
  mageBonus: [0.4, 0.8, 1.2], // extra on top for Mages
};

export const mage: TraitDef = {
  id: 'mage',
  name: 'Mage',
  icon: '✨',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'All allies gain +{allies} magic attack, Mages +{mages}.',
  values: () => ({
    allies: MAGE.allies.map(pct),
    mages: MAGE.allies.map((a, i) => pct(a + MAGE.mageBonus[i])),
  }),
  mods: ({ level, member }) => [{ stat: 'ap', pct: MAGE.allies[level - 1] + (member ? MAGE.mageBonus[level - 1] : 0) }],
};
