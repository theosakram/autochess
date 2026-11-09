import { pct } from '../traits/format';
import { PASSIVES, withPassives } from './passives';
import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const BLADE_ARMOR = {
  armor: 50,
  reflect: 0.3, // Vengeance: share of any damage taken from an enemy sent back, physical
};

export const bladeArmor: ItemDef = {
  id: 'bladearmor',
  name: 'Blade Armor',
  icon: '🦔',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc: `+${BLADE_ARMOR.armor} armor. Vengeance (unique): deals ${pct(BLADE_ARMOR.reflect)} of all damage taken back to the attacker as physical damage.`,
  values: () => ({}),
  mods: () => [{ stat: 'armor', add: BLADE_ARMOR.armor }],
  vengeance: BLADE_ARMOR.reflect,
};
bladeArmor.enhanced = withPassives(bladeArmor, PASSIVES.defiance);
