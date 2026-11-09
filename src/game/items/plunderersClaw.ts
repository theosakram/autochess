import { pct } from '../traits/format';
import type { ItemDef } from './types';

// The Plunderer's Claw, for a commander still to come (not in the drop pool). Plunder hooks the nearest enemy
// when the fight starts; the gold it takes adds to the claw's counter (kept across fights) until the cap, after
// which the claw gives damage instead.
export const PLUNDERERS_CLAW = {
  hybridAtk: 0.2, // + share of attack and magic attack
  hp: 0.2, // + share of max hp
  enhanced: 0.4, // both, enhanced
  stun: 1.5, // Plunder: seconds
  goldCap: 26, // gold in all, then no more
  damage: 0.25, // + damage once the cap is reached
};

export const plunderDamage = (gold: number) => (gold >= PLUNDERERS_CLAW.goldCap ? PLUNDERERS_CLAW.damage : 0);

const text = (n: number) =>
  `+${pct(n)} attack and magic attack, +${pct(n)} max HP. Plunder (unique): when a fight starts, hooks the nearest enemy, ` +
  `stunning it for ${PLUNDERERS_CLAW.stun}s and taking gold equal to its cost. The claw counts the gold (kept across fights); ` +
  `at ${PLUNDERERS_CLAW.goldCap} it takes no more gold and gives +${pct(PLUNDERERS_CLAW.damage)} damage instead.`;
const mods = (n: number) => [
  { stat: 'atk' as const, pct: n },
  { stat: 'ap' as const, pct: n },
  { stat: 'hp' as const, pct: n },
];

export const plunderersClaw: ItemDef = {
  id: 'plundererclaw',
  name: "Plunderer's Claw",
  icon: '⚓',
  kind: 'utility',
  maxTier: 1,
  exclusive: true,
  desc: text(PLUNDERERS_CLAW.hybridAtk),
  values: () => ({}),
  mods: () => mods(PLUNDERERS_CLAW.hybridAtk),
  plunder: { stun: PLUNDERERS_CLAW.stun, goldCap: PLUNDERERS_CLAW.goldCap },
  counted: (gold) => (plunderDamage(gold) ? [{ stat: 'damageAmp', add: plunderDamage(gold) }] : []),
  enhanced: { desc: text(PLUNDERERS_CLAW.enhanced), mods: () => mods(PLUNDERERS_CLAW.enhanced) },
};
