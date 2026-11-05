import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const PHASEWARPER = {
  below: 0.5, // hp fraction that triggers the warp, once per fight
  heal: [0.5, 0.75], // of max hp
  damageAmp: [0.3, 0.6], // for the rest of the fight
};

export const phasewarper: TraitDef = {
  id: 'phasewarper',
  name: 'Phasewarper',
  icon: '🌀',
  kind: 'role',
  breakpoints: [2, 3],
  desc:
    `The first time a Phasewarper drops below ${pct(PHASEWARPER.below)} HP, it warps to the safest tile, ` +
    'heals {heal} of its max HP and deals +{amp} damage for the rest of combat.',
  values: () => ({
    heal: PHASEWARPER.heal.map(pct),
    amp: PHASEWARPER.damageAmp.map(pct),
  }),
  mods: () => [],
  triggers: (level) => [
    {
      below: PHASEWARPER.below,
      teleport: true,
      healPct: PHASEWARPER.heal[level - 1],
      mods: [{ stat: 'damageAmp', add: PHASEWARPER.damageAmp[level - 1] }],
    },
  ],
};
