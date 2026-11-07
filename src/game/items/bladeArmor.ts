import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const BLADE_ARMOR = {
  armor: 50,
  reflect: 0.3, // Vengeance: share of a basic attack's damage sent back, physical
};

export const bladeArmor: ItemDef = {
  id: 'bladearmor',
  name: 'Blade Armor',
  icon: '🦔',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc: `+${BLADE_ARMOR.armor} armor. Vengeance (unique): when hit by a basic attack, deals ${pct(BLADE_ARMOR.reflect)} of the damage taken back to the attacker as physical damage.`,
  values: () => ({}),
  mods: () => [{ stat: 'armor', add: BLADE_ARMOR.armor }],
  vengeance: BLADE_ARMOR.reflect,
};
