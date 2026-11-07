import { enemiesOn, row3 } from './areas';
import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Irina (4g Astral / Deadeye). Per star, index 0 = 1★.
export const POLAR_BARRAGE = {
  shots: 3, // passive: every basic attack is this many shots, each a basic hit (so each sets off item effects)
  shot: 0.35, // of attack, each shot of a normal attack
  area: [1.55, 1.55, 4.6], // of attack, physical, to each enemy in the 3x1 row around its target
  charged: 3, // basic attacks enhanced afterwards
  enhanced: [3.5, 3.5, 9.4], // of attack, a whole enhanced attack (split over its shots)
};

export const polarBarrage: SkillDef = {
  id: 'polarbarrage',
  name: 'Polar Barrage',
  desc:
    `Passive: each basic attack fires ${POLAR_BARRAGE.shots} shots of {shot} of attack, each one setting off item effects. ` +
    'Active: strikes a 3x1 row centered on its target for {area} of attack as physical damage, ' +
    `then its next ${POLAR_BARRAGE.charged} attacks deal {enhanced} of attack each (over their ${POLAR_BARRAGE.shots} shots).`,
  damage: { shot: 'attack', area: 'physical', enhanced: 'attack' },
  values: () => ({ shot: [pct(POLAR_BARRAGE.shot)], area: POLAR_BARRAGE.area.map(pct), enhanced: POLAR_BARRAGE.enhanced.map(pct) }),
  volley(caster) {
    const P = POLAR_BARRAGE;
    const power = caster.skill.charged ? P.enhanced[caster.star - 1] / P.shots : P.shot;
    return { shots: P.shots, power };
  },
  cast(api, caster, target) {
    const center = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!center) return;
    const i = caster.star - 1;
    const raw = caster.stats.atk * POLAR_BARRAGE.area[i];
    for (const victim of enemiesOn(api, caster, row3(center))) api.hit(caster, victim, raw, 'physical', 'polarbarrage');
    caster.skill.charged = POLAR_BARRAGE.charged;
    api.showMarks(caster, caster.skill.charged, 'polarcharged');
  },
  // Counts whole attacks (all their shots, a hit-again included), not shots.
  afterAttack(api, caster) {
    if (!caster.skill.charged) return;
    caster.skill.charged--;
    api.showMarks(caster, caster.skill.charged, 'polarcharged');
  },
};
