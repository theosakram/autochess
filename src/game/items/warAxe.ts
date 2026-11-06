import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const WAR_AXE = {
  atk: 0.25, // + share of physical attack
  spellLifesteal: 0.1,
  defensePerStack: 8, // armor and magic resist, per Fighting Spirit stack
  stacks: 5,
  seconds: 3,
  ampAtMax: 0.1, // extra damage at max stacks
};

export const warAxe: ItemDef = {
  id: 'waraxe',
  name: 'War Axe',
  icon: '🪓',
  kind: 'offense',
  maxTier: 1,
  desc:
    `+${pct(WAR_AXE.atk)} physical attack, +${pct(WAR_AXE.spellLifesteal)} spell lifesteal. ` +
    `Fighting Spirit (unique): dealing damage grants +${WAR_AXE.defensePerStack} armor and magic resist for ${WAR_AXE.seconds}s, ` +
    `stacking up to ${WAR_AXE.stacks} times; at max stacks it also deals +${pct(WAR_AXE.ampAtMax)} damage.`,
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: WAR_AXE.atk },
    { stat: 'spellLifesteal', add: WAR_AXE.spellLifesteal },
  ],
  stacking: {
    effect: 'fightingspirit',
    perStack: [
      { stat: 'armor', add: WAR_AXE.defensePerStack },
      { stat: 'mr', add: WAR_AXE.defensePerStack },
    ],
    atMax: [{ stat: 'damageAmp', add: WAR_AXE.ampAtMax }],
    max: WAR_AXE.stacks,
    seconds: WAR_AXE.seconds,
  },
};
