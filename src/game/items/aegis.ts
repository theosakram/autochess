import { pct } from '../traits/format';
import { PASSIVES, withPassives } from './passives';
import type { ItemDef } from './types';

// Basic item. Tune with `bun run balance`.
export const AEGIS = {
  share: 0.25, // of each shielded unit's own max hp
  seconds: 25,
};

export const aegis: ItemDef = {
  id: 'aegis',
  name: 'Aegis',
  icon: '🛡️',
  kind: 'defense',
  maxTier: 1,
  basic: true,
  desc:
    `Aegis (unique): when a fight starts, the holder and the allies directly left and right of it each gain a shield ` +
    `of ${pct(AEGIS.share)} of their max HP for ${AEGIS.seconds}s.`,
  values: () => ({}),
  mods: () => [],
  sideShield: { effect: 'aegis', share: AEGIS.share, seconds: AEGIS.seconds },
};
aegis.enhanced = withPassives(aegis, PASSIVES.longevity);

