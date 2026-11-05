import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const STARGAZER = {
  selfRegen: [15, 20, 46], // extra mana/sec for Stargazers
  teamRegen: [6, 15, 32], // mana/sec for every ally, Stargazers included
};

export const stargazer: TraitDef = {
  id: 'stargazer',
  name: 'Stargazer',
  icon: '🔭',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'Stargazers gain +{self} mana/sec, other allies +{team}.',
  values: () => ({
    self: STARGAZER.selfRegen.map((n, i) => String(n + STARGAZER.teamRegen[i])),
    team: STARGAZER.teamRegen.map(String),
  }),
  mods: ({ level, member }) => [
    { stat: 'manaRegen', add: STARGAZER.teamRegen[level - 1] + (member ? STARGAZER.selfRegen[level - 1] : 0) },
  ],
};
