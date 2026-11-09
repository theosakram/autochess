import { pct } from '../traits/format';
import type { ItemDef, NamedPassive } from './types';

// Named unique passives that enhanced items add. Each counts once per unit, however many of its items carry it.
// Tune with `bun run balance`.
const passive = (id: string, name: string, mods: NamedPassive['mods'], text: string): NamedPassive => ({ id, name, mods, text });
export const PASSIVES = {
  swift: passive('swift', 'Swift', [{ stat: 'attackSpeed', add: 0.2 }], `+${pct(0.2)} attack speed`),
  longevity: passive('longevity', 'Longevity', [{ stat: 'hp', pct: 0.2 }], `+${pct(0.2)} max HP`),
  onslaught: passive('onslaught', 'Onslaught', [{ stat: 'damageAmp', add: 0.2 }], `+${pct(0.2)} damage`),
  pierce: passive('pierce', 'Pierce', [{ stat: 'armorPen', add: 0.25 }, { stat: 'atk', pct: 0.15 }], `+${pct(0.25)} physical penetration and +${pct(0.15)} physical attack`),
  spellbreaker: passive('spellbreaker', 'Spellbreaker', [{ stat: 'magicPen', add: 0.25 }, { stat: 'ap', pct: 0.15 }], `+${pct(0.25)} magic penetration and +${pct(0.15)} magic attack`),
  extract: passive('extract', 'Extract', [{ stat: 'spellLifesteal', add: 0.1 }, { stat: 'ap', pct: 0.1 }], `+${pct(0.1)} spell lifesteal and +${pct(0.1)} magic attack`),
  defiance: passive('defiance', 'Defiance', [{ stat: 'armor', add: 25 }], '+25 armor'),
  titan: passive('titan', 'Titan', [{ stat: 'hp', pct: 0.2 }], `+${pct(0.2)} max HP`),
  valiant: passive('valiant', 'Valiant', [{ stat: 'critChance', add: 0.15 }], `+${pct(0.15)} crit chance`),
  frenzy: passive('frenzy', 'Frenzy', [{ stat: 'lifesteal', add: 0.1 }, { stat: 'atk', pct: 0.1 }], `+${pct(0.1)} lifesteal (basic attacks) and +${pct(0.1)} physical attack`),
};

// An enhanced version that keeps everything the base does and adds named passives (written into its description).
export const withPassives = (base: Pick<ItemDef, 'desc'>, ...add: NamedPassive[]): ItemDef['enhanced'] => ({
  passives: add,
  desc: `${base.desc} ${add.map((p) => `${p.name} (unique): ${p.text}.`).join(' ')}`,
});
