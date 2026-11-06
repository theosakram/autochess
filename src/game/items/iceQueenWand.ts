import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (magic). Tune with `bun run balance`.
export const ICE_QUEEN_WAND = {
  ap: 0.15, // + share of magic attack
  spellVamp: 0.15,
  slow: 0.15, // Ice Bound: attack speed taken off the target
  seconds: 5,
};

export const iceQueenWand: ItemDef = {
  id: 'icequeenwand',
  name: 'Ice Queen Wand',
  icon: '❄️',
  kind: 'offense',
  maxTier: 1,
  desc:
    `+${pct(ICE_QUEEN_WAND.ap)} magic attack, +${pct(ICE_QUEEN_WAND.spellVamp)} spell vamp. ` +
    `Ice Bound (unique): skill damage cuts the target's attack speed by ${pct(ICE_QUEEN_WAND.slow)} for ${ICE_QUEEN_WAND.seconds}s.`,
  values: () => ({}),
  mods: () => [
    { stat: 'ap', pct: ICE_QUEEN_WAND.ap },
    { stat: 'spellLifesteal', add: ICE_QUEEN_WAND.spellVamp },
  ],
  skillHex: { effect: 'icebound', mods: [{ stat: 'attackSpeed', add: -ICE_QUEEN_WAND.slow }], seconds: ICE_QUEEN_WAND.seconds },
};
