import type { Point } from '../grid';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Johnnie (Johnson's own 3g hero, a random faction and role). Per star, index 0 = 1★.
export const PARTY_CRASHER = {
  // Passive, when the fight starts: leaps where the enemies are thickest.
  leapAp: [1.4, 1.5, 2.6], // of magic attack, magic, to each enemy in the 3x3 it lands in
  leapHp: [0.04, 0.05, 0.07], // of Johnnie's own max hp, added to each hit
  // Active: projectiles at the thickest group of enemies.
  ap: [2.4, 2.5, 4.4], // of magic attack, magic, to each enemy in the 3x3 around the enemy aimed at
  stun: [0.5, 0.7, 1], // seconds
};

// The living enemy with the most enemies in the 3x3 around it (itself counted); ties go to the nearest.
function densestEnemy(api: SkillApi, caster: SkillFighter): SkillFighter | null {
  const dist = (p: Point) => Math.max(Math.abs(p.x - caster.x), Math.abs(p.y - caster.y));
  let best: { e: SkillFighter; n: number } | null = null;
  for (const e of api.enemiesOf(caster)) {
    const n = 1 + enemiesOn(api, caster, around(e)).length;
    if (!best || n > best.n || (n === best.n && dist(e) < dist(best.e))) best = { e, n };
  }
  return best?.e ?? null;
}

export const partyCrasher: SkillDef = {
  id: 'partycrasher',
  name: 'Party Crasher',
  desc:
    'Passive: when combat starts, leaps where the enemies are thickest, hitting every enemy in the 3x3 it lands in (shredding them like an attack first) for ' +
    '{leapAp} of magic attack plus {leapHp} of its own max HP as magic damage. ' +
    'Active: throws a burst of projectiles at the thickest group of enemies: each enemy in the 3x3 takes {ap} of magic attack ' +
    'as magic damage and is stunned for {stun}.',
  damage: { leapAp: 'magic', leapHp: 'magic', ap: 'magic' },
  values: () => ({
    leapAp: PARTY_CRASHER.leapAp.map(pct),
    leapHp: PARTY_CRASHER.leapHp.map(pct),
    ap: PARTY_CRASHER.ap.map(pct),
    stun: PARTY_CRASHER.stun.map((s) => `${s}s`),
  }),
  atStartLate: true, // after every other passive: buffs by position (Val's mana) reach it before it leaps
  atStart(api, caster) {
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (!spot) return;
    api.dashTo(caster, spot);
    const raw = caster.stats.ap * PARTY_CRASHER.leapAp[i] + caster.maxHp * PARTY_CRASHER.leapHp[i];
    for (const e of enemiesOn(api, caster, around(caster))) {
      api.shred(e, caster); // the landing shreds like an attack (Hunter), before its damage
      api.hit(caster, e, raw, 'magic', 'partycrasher');
    }
  },
  cast(api, caster) {
    const i = caster.star - 1;
    const aim = densestEnemy(api, caster);
    if (!aim) return;
    const zone = [{ x: aim.x, y: aim.y }, ...around(aim)];
    api.showProjectile(caster, aim, 0.25, 'partythrow');
    for (const e of enemiesOn(api, caster, zone)) {
      api.hit(caster, e, caster.stats.ap * PARTY_CRASHER.ap[i], 'magic', 'partythrow');
      if (e.hp > 0) api.stun(e, PARTY_CRASHER.stun[i], caster);
    }
  },
};
