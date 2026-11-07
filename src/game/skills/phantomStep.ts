import { dist } from '../grid';
import { pct } from '../traits/format';
import { freeCellNextTo } from './dashStrike';
import type { SkillDef } from './types';

// Phantom Fist (3g Fighter). Per star, index 0 = 1★.
export const PHANTOM_STEP = {
  atk: [4, 5, 13], // of attack, physical
  stun: [1, 1.25, 1.75], // seconds
  shield: [0.2, 0.25, 0.4], // of its max hp
  seconds: 4,
};

export const phantomStep: SkillDef = {
  id: 'phantomstep',
  name: 'Phantom Step',
  desc:
    'Steps through the shadows to its target and strikes it for {atk} of attack as physical damage, stunning it for {stun}. ' +
    `It then gains a shield of {shield} of its max HP for ${PHANTOM_STEP.seconds}s.`,
  values: () => ({ atk: PHANTOM_STEP.atk.map(pct), stun: PHANTOM_STEP.stun.map((s) => `${s}s`), shield: PHANTOM_STEP.shield.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const i = caster.star - 1;
    if (dist(caster, victim) > 1) {
      const landing = freeCellNextTo(api, victim, caster);
      if (landing) api.dashTo(caster, landing);
    }
    if (!api.hit(caster, victim, caster.stats.atk * PHANTOM_STEP.atk[i], 'physical', 'phantomstep')) api.stun(victim, PHANTOM_STEP.stun[i], caster);
    api.shield(caster, caster.maxHp * PHANTOM_STEP.shield[i], PHANTOM_STEP.seconds, 'phantomstep');
  },
};
