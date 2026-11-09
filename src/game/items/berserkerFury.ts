import { pct } from '../traits/format';
import { PASSIVES, withPassives } from './passives';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const BERSERKER_FURY = {
  atk: 0.1, // + share of physical attack
  critChance: 0.2,
  critDamage: 0.4, // added to the crit damage multiplier
};

export const berserkerFury: ItemDef = {
  id: 'berserkerfury',
  name: "Berserker's Fury",
  icon: '😡',
  kind: 'offense',
  group: 'physical',
  maxTier: 1,
  desc: `+${pct(BERSERKER_FURY.atk)} physical attack, +${pct(BERSERKER_FURY.critChance)} crit chance, +${pct(BERSERKER_FURY.critDamage)} crit damage.`,
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: BERSERKER_FURY.atk },
    { stat: 'critChance', add: BERSERKER_FURY.critChance },
    { stat: 'critDamage', add: BERSERKER_FURY.critDamage },
  ],
};
berserkerFury.enhanced = withPassives(berserkerFury, PASSIVES.valiant);

