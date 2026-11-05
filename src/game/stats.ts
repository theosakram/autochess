import { BASE_CRIT_DAMAGE, CAST_MULT, STAR_MULT } from './config';
import type { Star, UnitDef } from './types';

export type DamageType = 'physical' | 'magic';

// What a unit fights with. Traits (and later items) change these only through
// StatMods; the combat engine reads stats and never looks at trait ids.
export interface Stats {
  hp: number;
  atk: number;
  armor: number;
  mr: number;
  maxMana: number;
  manaRegen: number; // per second
  armorShred: number; // armor and mr a basic attack removes from its target; doesn't stack
  damageAmp: number; // all damage this unit deals is multiplied by 1 + damageAmp
  critChance: number; // 0..1, basic attacks only
  critDamage: number; // multiplier on a critting basic attack
  castMult: number; // skill damage = atk x castMult (placeholder skill until real abilities)
  range: number;
  attackTicks: number;
}

export type StatKey = keyof Stats;

// `add` is flat. `pct` values stack additively and multiply once at the end (+10% and +20% = x1.3).
export interface StatMod {
  stat: StatKey;
  add?: number;
  pct?: number;
}

// `scale` multiplies hp and atk on top of stars; used by the balance tool.
export function baseStats(def: UnitDef, star: Star, scale = 1): Stats {
  const mult = STAR_MULT[star - 1] * scale;
  return {
    hp: def.hp * mult,
    atk: def.atk * mult,
    armor: def.armor,
    mr: def.mr,
    maxMana: def.mana,
    manaRegen: 0,
    armorShred: 0,
    damageAmp: 0,
    critChance: 0,
    critDamage: BASE_CRIT_DAMAGE,
    castMult: CAST_MULT,
    range: def.range,
    attackTicks: def.attackTicks,
  };
}

export function applyMods(base: Stats, mods: StatMod[]): Stats {
  const out = { ...base };
  const pct: Partial<Record<StatKey, number>> = {};
  for (const m of mods) {
    if (m.add) out[m.stat] += m.add;
    if (m.pct) pct[m.stat] = (pct[m.stat] ?? 0) + m.pct;
  }
  for (const [stat, p] of Object.entries(pct) as [StatKey, number][]) out[stat] *= 1 + p;
  out.hp = Math.round(out.hp);
  out.atk = Math.round(out.atk);
  return out;
}
