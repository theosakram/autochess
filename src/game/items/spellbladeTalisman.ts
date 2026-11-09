import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (hybrid). Tune with `bun run balance`.
export const SPELLBLADE_TALISMAN = {
  hybridAtk: 0.15, // + share of attack and magic attack
  startMana: 0.55, // Recharge: of max mana, when the fight starts
  enhanced: { startMana: 0.8, skillDamage: 0.15 },
};

const text = (mana: number, skill = 0) =>
  `+${pct(SPELLBLADE_TALISMAN.hybridAtk)} attack and magic attack${skill ? `, +${pct(skill)} skill damage` : ''}. ` +
  `Recharge (unique): starts every fight with ${pct(mana)} of its max mana.`;

export const spellbladeTalisman: ItemDef = {
  id: 'spellbladetalisman',
  name: 'Spellblade Talisman',
  icon: '🔋',
  kind: 'offense',
  group: 'hybrid',
  maxTier: 1,
  desc: text(SPELLBLADE_TALISMAN.startMana),
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: SPELLBLADE_TALISMAN.hybridAtk },
    { stat: 'ap', pct: SPELLBLADE_TALISMAN.hybridAtk },
  ],
  startMana: SPELLBLADE_TALISMAN.startMana,
  enhanced: {
    desc: text(SPELLBLADE_TALISMAN.enhanced.startMana, SPELLBLADE_TALISMAN.enhanced.skillDamage),
    startMana: SPELLBLADE_TALISMAN.enhanced.startMana,
    mods: () => [
      { stat: 'atk', pct: SPELLBLADE_TALISMAN.hybridAtk },
      { stat: 'ap', pct: SPELLBLADE_TALISMAN.hybridAtk },
      { stat: 'skillAmp', add: SPELLBLADE_TALISMAN.enhanced.skillDamage },
    ],
  },
};
