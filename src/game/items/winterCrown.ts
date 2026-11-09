import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (hybrid). Tune with `bun run balance`.
export const WINTER_CROWN = {
  hybridAtk: 0.1, // + share of attack and magic attack
  hp: 0.1, // + share of max hp
  below: 0.25, // Freeze: of max hp (or a lethal hit)
  seconds: 1,
  heal: 0.1, // of max hp, over the freeze
  enhanced: { heal: 0.25, mana: 0.1 }, // mana: of max mana, when it freezes
};

const text = (heal: number, mana = 0) =>
  `+${pct(WINTER_CROWN.hybridAtk)} attack and magic attack, +${pct(WINTER_CROWN.hp)} max HP. ` +
  `Freeze (unique, once per fight): dropping below ${pct(WINTER_CROWN.below)} HP, or taking a lethal hit (it survives at 1 HP), ` +
  `freezes it for ${WINTER_CROWN.seconds}s: it can't act or be hurt, enemies can't target it, and it restores ${pct(heal)} of its max HP` +
  `${mana ? ` and ${pct(mana)} of its max mana` : ''}.`;

export const winterCrown: ItemDef = {
  id: 'wintercrown',
  name: 'Winter Crown',
  icon: '🧊',
  kind: 'defense',
  group: 'hybrid',
  maxTier: 1,
  desc: text(WINTER_CROWN.heal),
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: WINTER_CROWN.hybridAtk },
    { stat: 'ap', pct: WINTER_CROWN.hybridAtk },
    { stat: 'hp', pct: WINTER_CROWN.hp },
  ],
  freeze: { below: WINTER_CROWN.below, seconds: WINTER_CROWN.seconds, heal: WINTER_CROWN.heal },
  enhanced: {
    desc: text(WINTER_CROWN.enhanced.heal, WINTER_CROWN.enhanced.mana),
    freeze: { below: WINTER_CROWN.below, seconds: WINTER_CROWN.seconds, heal: WINTER_CROWN.enhanced.heal, mana: WINTER_CROWN.enhanced.mana },
  },
};
