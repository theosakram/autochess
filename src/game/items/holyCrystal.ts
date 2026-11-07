import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (magic). Tune with `bun run balance`.
export const HOLY_CRYSTAL = {
  ap: 0.2, // + share of magic attack
  skillDamage: 0.1, // Mystery (unique)
};

export const holyCrystal: ItemDef = {
  id: 'holycrystal',
  name: 'Holy Crystal',
  icon: '💎',
  kind: 'offense',
  group: 'magic',
  maxTier: 1,
  desc: `+${pct(HOLY_CRYSTAL.ap)} magic attack. Mystery (unique): +${pct(HOLY_CRYSTAL.skillDamage)} skill damage.`,
  values: () => ({}),
  mods: () => [{ stat: 'ap', pct: HOLY_CRYSTAL.ap }],
  unique: () => [{ stat: 'skillAmp', add: HOLY_CRYSTAL.skillDamage }],
};
