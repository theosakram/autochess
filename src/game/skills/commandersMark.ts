import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Senopati (4g Deadeye). Per star, index 0 = 1★.
export const COMMANDERS_MARK = {
  marks: 5, // basic attacks on one target to set the marks off
  focusMarks: 4, // ...while the active is on
  burst: [1.8, 2, 4], // of attack, physical, when the marks go off
  attackSpeed: [0.5, 0.6, 1], // active
  seconds: 5,
};

export const commandersMark: SkillDef = {
  id: 'commandersmark',
  name: "Commander's Mark",
  desc:
    `Passive: every basic attack marks its target. At ${COMMANDERS_MARK.marks} marks they burst for {burst} of attack as physical damage. ` +
    `Active: for ${COMMANDERS_MARK.seconds}s, gains +{as} attack speed and bursts at ${COMMANDERS_MARK.focusMarks} marks.`,
  values: () => ({ burst: COMMANDERS_MARK.burst.map(pct), as: COMMANDERS_MARK.attackSpeed.map(pct) }),
  onBasicHit(api, caster, target) {
    if (target.hp <= 0) return;
    const key = `mark${target.id}`;
    const marks = (caster.skill[key] ?? 0) + 1;
    const needed = api.hasBuff(caster, 'commandersmark') ? COMMANDERS_MARK.focusMarks : COMMANDERS_MARK.marks;
    if (marks < needed) {
      caster.skill[key] = marks;
      api.showMarks(target, marks, 'commandersmark');
      return;
    }
    caster.skill[key] = 0;
    api.showMarks(target, 0, 'commandersmark');
    api.hit(caster, target, caster.stats.atk * COMMANDERS_MARK.burst[caster.star - 1], 'physical', 'markburst');
  },
  cast(api, caster) {
    api.buff(caster, [{ stat: 'attackSpeed', add: COMMANDERS_MARK.attackSpeed[caster.star - 1] }], COMMANDERS_MARK.seconds, 'commandersmark', caster);
  },
};
