import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const SKYBRINGER = {
  damageAmp: [0.1, 0.2, 0.3, 1], // Skybringers only, all damage they deal
  lightning: [0.08, 0.225, 0.26, 0.75], // of each enemy's max hp per strike, magic
  every: 3, // seconds between strikes
  strikes: 3,
};

export const skybringer: TraitDef = {
  id: 'skybringer',
  name: 'Skybringer',
  icon: '⚡',
  kind: 'faction',
  breakpoints: [2, 4, 6, 10],
  desc:
    `Skybringers deal +{amp} damage. Every ${SKYBRINGER.every}s, ${SKYBRINGER.strikes} times, ` +
    'lightning hits all enemies for {zap} of their max HP as magic damage.',
  values: () => ({
    amp: SKYBRINGER.damageAmp.map(pct),
    zap: SKYBRINGER.lightning.map(pct),
  }),
  mods: ({ level, member }) => (member ? [{ stat: 'damageAmp', add: SKYBRINGER.damageAmp[level - 1] }] : []),
  pulses: (level) => [
    { every: SKYBRINGER.every, times: SKYBRINGER.strikes, pctMaxHp: SKYBRINGER.lightning[level - 1], damageType: 'magic' },
  ],
};
