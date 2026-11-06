import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (hybrid). Tune with `bun run balance`.
export const SPELLBLADE_TALISMAN = {
  hybridAtk: 0.15, // + share of attack and magic attack
  startMana: 0.55, // Recharge: of max mana, when the fight starts
};

export const spellbladeTalisman: ItemDef = {
  id: 'spellbladetalisman',
  name: 'Spellblade Talisman',
  icon: '🔋',
  kind: 'offense',
  maxTier: 1,
  desc: `+${pct(SPELLBLADE_TALISMAN.hybridAtk)} attack and magic attack. Recharge (unique): starts every fight with ${pct(SPELLBLADE_TALISMAN.startMana)} of its max mana.`,
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: SPELLBLADE_TALISMAN.hybridAtk },
    { stat: 'ap', pct: SPELLBLADE_TALISMAN.hybridAtk },
  ],
  startMana: SPELLBLADE_TALISMAN.startMana,
};
