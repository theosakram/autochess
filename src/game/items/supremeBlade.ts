import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Katarina's Supreme Blade (not in the drop pool). Gift executes enemies next to the
// holder, and every execution adds to the blade's counter (kept across fights) for more damage.
export const SUPREME_BLADE = {
  hybridAtk: 0.35, // + share of attack and magic attack
  hp: 0.25, // + share of max hp
  enhanced: { hybridAtk: 0.55, hp: 0.3 },
  below: 0.18, // Gift: executes an adjacent enemy under this share of its max hp
  perExecute: 0.02, // + damage per execution on its counter
  maxDamage: 0.36, // cap (18 executions)
};

export const giftDamage = (count: number) => Math.min(SUPREME_BLADE.maxDamage, count * SUPREME_BLADE.perExecute);

const text = (atk: number, hp: number) =>
  `+${pct(atk)} attack and magic attack, +${pct(hp)} max HP. Gift (unique): executes enemies next to the holder that are under ` +
  `${pct(SUPREME_BLADE.below)} of their max HP. Each execution adds 1 to the blade's counter, kept across fights: ` +
  `+${pct(SUPREME_BLADE.perExecute)} damage each, up to +${pct(SUPREME_BLADE.maxDamage)}. Only from Commander Katarina.`;
const mods = (atk: number, hp: number) => [
  { stat: 'atk' as const, pct: atk },
  { stat: 'ap' as const, pct: atk },
  { stat: 'hp' as const, pct: hp },
];

export const supremeBlade: ItemDef = {
  id: 'supremeblade',
  name: 'Supreme Blade',
  icon: '⚔️',
  kind: 'offense',
  maxTier: 1,
  exclusive: true,
  desc: text(SUPREME_BLADE.hybridAtk, SUPREME_BLADE.hp),
  values: () => ({}),
  mods: () => mods(SUPREME_BLADE.hybridAtk, SUPREME_BLADE.hp),
  gift: { below: SUPREME_BLADE.below },
  counted: (count) => [{ stat: 'damageAmp', add: giftDamage(count) }],
  enhanced: {
    desc: text(SUPREME_BLADE.enhanced.hybridAtk, SUPREME_BLADE.enhanced.hp),
    mods: () => mods(SUPREME_BLADE.enhanced.hybridAtk, SUPREME_BLADE.enhanced.hp),
  },
};
