import { describe, expect, test } from 'bun:test';
import { UNITS } from '../../game/units';
import { attackLook, physiqueOf, PLINTHS } from './physique';

describe('physique', () => {
  test('defenders and dauntless are tanks, range decides the rest', () => {
    for (const def of UNITS) {
      const p = physiqueOf(def);
      if (def.traits.includes('defender') || def.traits.includes('dauntless')) expect(p).toBe('tank');
      else expect(p).toBe(def.range > 1 ? 'ranged' : 'melee');
    }
  });

  test('every build is in use', () => {
    expect(new Set(UNITS.map(physiqueOf))).toEqual(new Set(['tank', 'melee', 'ranged']));
  });

  test('plinths shrink from tank to ranged', () => {
    expect(PLINTHS.tank.radius).toBeGreaterThan(PLINTHS.melee.radius);
    expect(PLINTHS.melee.radius).toBeGreaterThan(PLINTHS.ranged.radius);
    expect(PLINTHS.tank.height).toBeGreaterThan(PLINTHS.melee.height);
    expect(PLINTHS.melee.height).toBeGreaterThan(PLINTHS.ranged.height);
  });

  test('melee swings, ranged shoot arrows or (magic) bolts; Melina shoots comets', () => {
    for (const def of UNITS) {
      const look = attackLook(def);
      if (def.id === 'melina') expect(look).toBe('comet');
      else if (def.range <= 1) expect(look).toBe('swing');
      else expect(look).toBe(def.attackType === 'magic' ? 'bolt' : 'arrow');
    }
    expect(new Set(UNITS.map(attackLook))).toEqual(new Set(['swing', 'arrow', 'bolt', 'comet']));
  });
});
