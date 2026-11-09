import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const WAR_AXE = {
  atk: 0.1, // + share of physical attack
  spellLifesteal: 0.15,
  defensePerStack: 4, // armor and magic resist, per Fighting Spirit stack
  stacks: 5,
  seconds: 3,
  ampAtMax: 0.1, // extra damage at max stacks
  enhanced: { defensePerStack: 6, ampAtMax: 0.3 },
};

const text = (def: number, amp: number) =>
  `+${pct(WAR_AXE.atk)} physical attack, +${pct(WAR_AXE.spellLifesteal)} spell lifesteal. ` +
  `Fighting Spirit (unique): dealing damage grants +${def} armor and magic resist for ${WAR_AXE.seconds}s, ` +
  `stacking up to ${WAR_AXE.stacks} times; at max stacks it also deals +${pct(amp)} damage.`;
const spirit = (def: number, amp: number) => ({
  effect: 'fightingspirit',
  perStack: [
    { stat: 'armor' as const, add: def },
    { stat: 'mr' as const, add: def },
  ],
  atMax: [{ stat: 'damageAmp' as const, add: amp }],
  max: WAR_AXE.stacks,
  seconds: WAR_AXE.seconds,
});

export const warAxe: ItemDef = {
  id: 'waraxe',
  name: 'War Axe',
  icon: '🪓',
  kind: 'offense',
  group: 'physical',
  maxTier: 1,
  desc: text(WAR_AXE.defensePerStack, WAR_AXE.ampAtMax),
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: WAR_AXE.atk },
    { stat: 'spellLifesteal', add: WAR_AXE.spellLifesteal },
  ],
  stacking: spirit(WAR_AXE.defensePerStack, WAR_AXE.ampAtMax),
  enhanced: {
    desc: text(WAR_AXE.enhanced.defensePerStack, WAR_AXE.enhanced.ampAtMax),
    stacking: spirit(WAR_AXE.enhanced.defensePerStack, WAR_AXE.enhanced.ampAtMax),
  },
};
