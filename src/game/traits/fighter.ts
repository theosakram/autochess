import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const FIGHTER = {
  basicAmp: [0.15, 0.3, 0.55], // basic attack damage, Fighters only
  hitAgain: [0.2, 0.4, 0.6], // chance a basic attack strikes the same target again, Fighters only
};

export const fighter: TraitDef = {
  id: 'fighter',
  name: 'Fighter',
  icon: '🥊',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'Fighters deal +{amp} basic attack damage and have {again} chance to hit again.',
  values: () => ({ amp: FIGHTER.basicAmp.map(pct), again: FIGHTER.hitAgain.map(pct) }),
  mods: ({ level, member }) =>
    member
      ? [
          { stat: 'basicAmp', add: FIGHTER.basicAmp[level - 1] },
          { stat: 'hitAgain', add: FIGHTER.hitAgain[level - 1] },
        ]
      : [],
};
