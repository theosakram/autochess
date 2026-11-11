import type { UnitDef } from '../../game/types';

// A piece's build on the board: its plinth says at a glance who stands in front and who shoots from the back.
export type Physique = 'tank' | 'melee' | 'ranged';

const TANK_ROLES = new Set(['defender', 'dauntless']);

export function physiqueOf(def: UnitDef): Physique {
  if (def.traits.some((t) => TANK_ROLES.has(t))) return 'tank';
  return def.range > 1 ? 'ranged' : 'melee';
}

// Plinth size per build, in cells: tanks broad and tall, the back line slim and low.
export const PLINTHS: Record<Physique, { radius: number; height: number }> = {
  tank: { radius: 0.34, height: 0.3 },
  melee: { radius: 0.28, height: 0.18 },
  ranged: { radius: 0.22, height: 0.1 },
};

// How its basic attack looks: melee swings (the piece leans in); ranged fire an arrow, or a bolt if they hit with magic.
export type AttackLook = 'swing' | 'arrow' | 'bolt';

export function attackLook(def: UnitDef): AttackLook {
  if (def.range <= 1) return 'swing';
  return def.attackType === 'magic' ? 'bolt' : 'arrow';
}
