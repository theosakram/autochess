import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const DAUNTLESS = {
  // Start-of-combat shield, of max hp, lasts the whole fight.
  allies: [0.05, 0.1, 0.2], // every ally
  dauntlessBonus: [0.2, 0.4, 0.85], // extra on top for Dauntless units
  shield: (level: number, member: boolean) => DAUNTLESS.allies[level - 1] + (member ? DAUNTLESS.dauntlessBonus[level - 1] : 0),
};

export const dauntless: TraitDef = {
  id: 'dauntless',
  name: 'Dauntless',
  icon: '🔰',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'All allies start combat with a shield of {allies} of their max HP, Dauntless units {dauntless}.',
  values: () => ({
    allies: DAUNTLESS.allies.map(pct),
    dauntless: DAUNTLESS.allies.map((_, i) => pct(DAUNTLESS.shield(i + 1, true))),
  }),
  mods: ({ level, member }) => [{ stat: 'startShield', add: DAUNTLESS.shield(level, member) }],
};
