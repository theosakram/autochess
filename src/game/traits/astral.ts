import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const ASTRAL = {
  damageAmp: [0.1, 0.2, 0.3, 1], // every Astral unit
  sovereignAmp: [0.2, 0.4, 0.9, 3], // extra on top for the Sovereign
  sovereignLifesteal: [0.05, 0.1, 0.15, 0.4], // hybrid: basic attacks and spells
  sovereigns: [1, 1, 1, 2], // how many Astrals become Sovereigns
};

export const astral: TraitDef = {
  id: 'astral',
  name: 'Astral',
  icon: '🌌',
  kind: 'faction',
  breakpoints: [2, 4, 6, 10],
  desc:
    'Astral units deal +{amp} damage. The Astral carrying the most items becomes the Astral Sovereign ' +
    '(at 10, the top two do): +{sovereign} more damage and {lifesteal} hybrid lifesteal (basic attacks and spells).',
  values: () => ({
    amp: ASTRAL.damageAmp.map(pct),
    sovereign: ASTRAL.sovereignAmp.map(pct),
    lifesteal: ASTRAL.sovereignLifesteal.map(pct),
  }),
  mods: ({ level, member, leader }) => {
    if (!member) return [];
    const i = level - 1;
    if (!leader) return [{ stat: 'damageAmp', add: ASTRAL.damageAmp[i] }];
    return [
      { stat: 'damageAmp', add: ASTRAL.damageAmp[i] + ASTRAL.sovereignAmp[i] },
      { stat: 'lifesteal', add: ASTRAL.sovereignLifesteal[i] },
      { stat: 'spellLifesteal', add: ASTRAL.sovereignLifesteal[i] },
    ];
  },
  leader: { title: 'Astral Sovereign', icon: '🌠', count: (level) => ASTRAL.sovereigns[level - 1] },
};
