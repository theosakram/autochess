import { pct } from '../traits/format';
import { PASSIVES, withPassives } from './passives';
import type { ItemDef } from './types';

// Basic item. Tune with `bun run balance`.
export const REVITALIZE = {
  below: 0.5, // of max hp
  seconds: 5,
  every: 1,
  heal: 0.06, // of each ally's own max hp, per tick
};

export const revitalize: ItemDef = {
  id: 'revitalize',
  name: 'Revitalize',
  icon: '⛲',
  kind: 'defense',
  maxTier: 1,
  basic: true,
  desc:
    `Revitalize (unique): the first time the holder drops below ${pct(REVITALIZE.below)} HP in a fight, it summons a Healing Spring on its tile ` +
    `for ${REVITALIZE.seconds}s: every ${REVITALIZE.every}s, allies in the 3x3 around it restore ${pct(REVITALIZE.heal)} of their max HP.`,
  values: () => ({}),
  mods: () => [],
  spring: { effect: 'revitalize', ...REVITALIZE },
};
revitalize.enhanced = withPassives(revitalize, PASSIVES.longevity);

