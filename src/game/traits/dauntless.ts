import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const DAUNTLESS = {
  shield: [0.6, 0.95, 1.5], // of max hp, Dauntless units only, lasts the whole fight
};

export const dauntless: TraitDef = {
  id: 'dauntless',
  name: 'Dauntless',
  icon: '🔰',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'Dauntless units start combat with a shield of {shield} of their max HP.',
  values: () => ({ shield: DAUNTLESS.shield.map(pct) }),
  mods: ({ level, member }) => (member ? [{ stat: 'startShield', add: DAUNTLESS.shield[level - 1] }] : []),
};
