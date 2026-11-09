import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (magic). Tune with `bun run balance`.
export const HOLY_CRYSTAL = {
  ap: 0.2, // + share of magic attack
  skillDamage: 0.1, // Mystery (unique)
  skillDamageEnhanced: 0.3,
};

const text = (amp: number) => `+${pct(HOLY_CRYSTAL.ap)} magic attack. Mystery (unique): +${pct(amp)} skill damage.`;

export const holyCrystal: ItemDef = {
  id: 'holycrystal',
  name: 'Holy Crystal',
  icon: '💎',
  kind: 'offense',
  group: 'magic',
  maxTier: 1,
  desc: text(HOLY_CRYSTAL.skillDamage),
  values: () => ({}),
  mods: () => [{ stat: 'ap', pct: HOLY_CRYSTAL.ap }],
  unique: () => [{ stat: 'skillAmp', add: HOLY_CRYSTAL.skillDamage }],
  enhanced: { desc: text(HOLY_CRYSTAL.skillDamageEnhanced), unique: () => [{ stat: 'skillAmp', add: HOLY_CRYSTAL.skillDamageEnhanced }] },
};
