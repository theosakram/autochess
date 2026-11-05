import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const DEFENDER = {
  allies: [25, 40, 110], // armor and magic resist for every ally
  defenderBonus: [40, 60, 170], // extra on top for Defenders
};

export const defender: TraitDef = {
  id: 'defender',
  name: 'Defender',
  icon: '🛡️',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'All allies gain +{allies} armor and magic resist, Defenders +{defenders}.',
  values: () => ({
    allies: DEFENDER.allies.map(String),
    defenders: DEFENDER.allies.map((a, i) => String(a + DEFENDER.defenderBonus[i])),
  }),
  mods: ({ level, member }) => {
    const n = DEFENDER.allies[level - 1] + (member ? DEFENDER.defenderBonus[level - 1] : 0);
    return [
      { stat: 'armor', add: n },
      { stat: 'mr', add: n },
    ];
  },
};
