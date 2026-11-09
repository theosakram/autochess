import { BASE_CRIT_DAMAGE, CAST_MULT, STAR_MULT } from './config';
import type { Star, UnitDef } from './types';

// pure ignores armor and mr; adaptive is physical or magic, whichever of the dealer's attack and magic attack is
// higher (physical on a tie), worked out on each hit.
export type DamageType = 'physical' | 'magic' | 'pure' | 'adaptive';

// Adaptive damage: the stat it scales off (the higher of attack and magic attack) and the type it lands as.
export const adaptivePower = (s: Pick<Stats, 'atk' | 'ap'>) => Math.max(s.atk, s.ap);
export const adaptiveType = (s: Pick<Stats, 'atk' | 'ap'>): 'physical' | 'magic' => (s.ap > s.atk ? 'magic' : 'physical');

// What a unit fights with. Traits (and later items) change these only through
// StatMods; the combat engine reads stats and never looks at trait ids.
// How long a basic-attack burn (Stats.burnOnHit) lasts, refreshed by every hit.
export const BURN_SECONDS = 2;

export interface Stats {
  hp: number;
  atk: number; // physical attack
  ap: number; // magic attack
  armor: number;
  mr: number;
  maxMana: number;
  manaRegen: number; // per second
  armorShred: number; // armor and mr a basic attack removes from its target; doesn't stack
  magicPen: number; // share of the target's magic resist its magic damage ignores (0..1)
  burnOnHit: number; // basic attacks burn the target: this share of its max hp per second, magic, for BURN_SECONDS
  damageAmp: number; // all damage this unit deals is multiplied by 1 + damageAmp
  damageTaken: number; // all damage this unit takes is multiplied by 1 + damageTaken (e.g. Weak)
  critChance: number; // 0..1, basic attacks only
  critDamage: number; // multiplier on a critting basic attack
  basicAmp: number; // basic attacks (and enhanced ones) deal x (1 + basicAmp)
  hitAgain: number; // chance a basic attack strikes again right away (the extra hit can't repeat)
  startShield: number; // shield at the start of combat, as a fraction of max hp; lasts the whole fight
  castMult: number; // placeholder skill damage = ap x castMult, for units without a real skill
  skillAmp: number; // skill damage (real skills and the placeholder cast) x (1 + skillAmp)
  lifesteal: number; // share of basic-attack damage healed back
  spellLifesteal: number; // share of all other damage dealt healed back
  range: number;
  attackTicks: number; // base ticks between attacks
  attackSpeed: number; // multiplier on attack rate: 1.25 attacks 25% more often
}

// Ticks between attacks, after attack speed.
export const attackInterval = (s: Stats) => Math.max(1, Math.round(s.attackTicks / s.attackSpeed));

export type StatKey = keyof Stats;

// `add` is flat. `pct` values stack additively and multiply once at the end (+10% and +20% = x1.3).
export interface StatMod {
  stat: StatKey;
  add?: number;
  pct?: number;
}

// `scale` multiplies hp, atk and ap on top of stars; used by the balance tool.
export function baseStats(def: UnitDef, star: Star | 4, scale = 1): Stats {
  const mult = STAR_MULT[star - 1] * scale;
  const set = def.starStats;
  const pick = (base: number, perStar: number[] | undefined) =>
    !perStar ? base * mult : star === 4 ? perStar[2] * (STAR_MULT[3] / STAR_MULT[2]) * scale : perStar[star - 1] * scale;
  return {
    hp: pick(def.hp, set?.hp),
    atk: pick(def.atk, set?.atk),
    ap: pick(def.ap, set?.ap),
    armor: def.armor,
    mr: def.mr,
    maxMana: set?.mana ? set.mana[Math.min(star, 3) - 1] : def.mana,
    manaRegen: 0,
    armorShred: 0,
    magicPen: 0,
    burnOnHit: 0,
    damageAmp: 0,
    damageTaken: 0,
    critChance: 0,
    critDamage: BASE_CRIT_DAMAGE,
    basicAmp: 0,
    hitAgain: 0,
    startShield: 0,
    castMult: CAST_MULT,
    skillAmp: 0,
    lifesteal: 0,
    spellLifesteal: 0,
    range: def.range,
    attackTicks: set?.attackTicks ? set.attackTicks[Math.min(star, 3) - 1] : def.attackTicks,
    attackSpeed: 1,
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
  out.ap = Math.round(out.ap);
  return out;
}
