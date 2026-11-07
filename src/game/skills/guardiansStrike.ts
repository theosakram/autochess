import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Hilos (2g Mooneater / Defender): the temple guardian. Per star, index 0 = 1★.
export const GUARDIANS_STRIKE = {
  ap: [4.75, 6.4, 13.8], // of magic attack, magic damage, as an enhanced basic hit
  shield: [360, 640, 1380], // flat
  seconds: 4,
};

export const guardiansStrike: SkillDef = {
  id: 'guardiansstrike',
  name: "Guardian's Strike",
  desc: `Empowers its next attack to deal {ap} of magic attack as magic damage, then gains a {shield} shield for ${GUARDIANS_STRIKE.seconds}s.`,
  damage: { ap: 'magic' },
  values: () => ({ ap: GUARDIANS_STRIKE.ap.map(pct), shield: GUARDIANS_STRIKE.shield.map(String) }),
  cast(api, caster, target) {
    const i = caster.star - 1;
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (victim) api.basicHit(caster, victim, caster.stats.ap * GUARDIANS_STRIKE.ap[i], 'magic', 'guardiansstrike');
    // The shield comes whether or not the hit killed.
    api.shield(caster, GUARDIANS_STRIKE.shield[i], GUARDIANS_STRIKE.seconds, 'guardiansstrike');
  },
};
