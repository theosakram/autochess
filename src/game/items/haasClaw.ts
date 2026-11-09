import { pct } from '../traits/format';
import { PASSIVES, withPassives } from './passives';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const HAAS_CLAW = {
  atk: 0.2, // + share of physical attack
  critChance: 0.15,
  lifesteal: 0.15, // unique attribute
};

export const haasClaw: ItemDef = {
  id: 'haasclaw',
  name: "Haas's Claw",
  icon: '🐾',
  kind: 'offense',
  group: 'physical',
  maxTier: 1,
  desc:
    `+${pct(HAAS_CLAW.atk)} physical attack, +${pct(HAAS_CLAW.critChance)} crit chance. ` +
    `Unique attribute: +${pct(HAAS_CLAW.lifesteal)} lifesteal (once per hero, however many it holds).`,
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: HAAS_CLAW.atk },
    { stat: 'critChance', add: HAAS_CLAW.critChance },
  ],
  unique: () => [{ stat: 'lifesteal', add: HAAS_CLAW.lifesteal }],
};
haasClaw.enhanced = withPassives(haasClaw, PASSIVES.frenzy);

