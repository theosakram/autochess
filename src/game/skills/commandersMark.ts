import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Kari (4g Gustiwana / Deadeye). Per star, index 0 = 1★.
export const COMMANDERS_MARK = {
  marks: 5, // basic attacks on one target to set the marks off
  focusMarks: 4, // ...while the active is on
  burst: [1.3, 1.3, 5], // of attack, physical, when the marks go off
  attackSpeed: [0.8, 0.8, 1.2], // active
  atk: [0.4, 0.4, 1.1], // active: more attack, a share of its own
  seconds: 5,
};

const EFFECT = 'commandersmark';

export const commandersMark: SkillDef = {
  id: 'commandersmark',
  name: "Commander's Mark",
  desc:
    `Passive: every basic attack marks its target. At ${COMMANDERS_MARK.marks} marks they explode for {burst} of attack as physical damage. ` +
    `Active: for ${COMMANDERS_MARK.seconds}s, gains +{as} attack speed and +{atk} attack, and the marks explode at ${COMMANDERS_MARK.focusMarks}.`,
  damage: { burst: 'physical' },
  values: () => ({ burst: COMMANDERS_MARK.burst.map(pct), as: COMMANDERS_MARK.attackSpeed.map(pct), atk: COMMANDERS_MARK.atk.map(pct) }),
  onBasicHit(api, caster, target) {
    if (target.hp <= 0) return;
    const key = `mark${target.id}`;
    const marks = (caster.skill[key] ?? 0) + 1;
    const needed = api.hasBuff(caster, EFFECT) ? COMMANDERS_MARK.focusMarks : COMMANDERS_MARK.marks;
    if (marks < needed) {
      caster.skill[key] = marks;
      api.showMarks(target, marks, EFFECT);
      return;
    }
    caster.skill[key] = 0;
    api.showMarks(target, 0, EFFECT);
    api.hit(caster, target, caster.stats.atk * COMMANDERS_MARK.burst[caster.star - 1], 'physical', 'markburst');
  },
  cast(api, caster) {
    const i = caster.star - 1;
    // Recast mid-buff: read the attack without the old bonus (the buff refreshes, not stacks).
    const base = caster.stats.atk - (api.hasBuff(caster, EFFECT) ? (caster.skill.bonusAtk ?? 0) : 0);
    caster.skill.bonusAtk = Math.round(base * COMMANDERS_MARK.atk[i]);
    api.buff(
      caster,
      [
        { stat: 'attackSpeed', add: COMMANDERS_MARK.attackSpeed[i] },
        { stat: 'atk', add: caster.skill.bonusAtk },
      ],
      COMMANDERS_MARK.seconds,
      EFFECT,
      caster,
    );
  },
};
