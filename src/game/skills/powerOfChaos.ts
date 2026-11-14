import { pct } from '../traits/format';
import type { SkillDef, SkillFighter } from './types';

// Lunox (4g Gustiwana / Stargazer): dash, boom, boom, boom. Per star, index 0 = 1★.
// Like Harley's Shade Bolts, a timed volley of skill bolts while she keeps fighting: her mana refills during
// it, so with enough mana she dashes and starts the next volley before this one ends.
export const POWER_OF_CHAOS = {
  ap: [4.5, 5, 13.5], // of magic attack, magic, per Chaos Bolt
  bolts: 3,
  every: 0.35, // seconds: after the dash, between bolts
};

const EFFECT = 'chaosassault';

export const powerOfChaos: SkillDef = {
  id: 'powerofchaos',
  name: 'Power of Chaos',
  desc:
    `Dashes to a safe location, then fires ${POWER_OF_CHAOS.bolts} Chaos Bolts, ${POWER_OF_CHAOS.every}s apart, each at the nearest enemy ` +
    'for {ap} of magic attack as magic damage. A bolt that kills fires 1 more. She keeps attacking, and gaining mana, meanwhile.',
  damage: { ap: 'magic' },
  values: () => ({ ap: POWER_OF_CHAOS.ap.map(pct) }),
  cast(api, caster) {
    const safe = api.safestCell(caster);
    if (safe.x !== caster.x || safe.y !== caster.y) api.dashTo(caster, safe);
    const raw = caster.stats.ap * POWER_OF_CHAOS.ap[caster.star - 1];
    let left = POWER_OF_CHAOS.bolts;
    // One bolt, then the next one scheduled while any are left (so a kill can add one).
    const bolt = () => {
      const target: SkillFighter | null = api.nearestEnemy(caster);
      if (!target) return;
      left--;
      api.showProjectile(caster, target, 0.2, EFFECT);
      if (api.hit(caster, target, raw, 'magic', EFFECT)) left++;
      api.showMarks(caster, left, EFFECT);
      if (left > 0) api.repeat(caster, POWER_OF_CHAOS.every, 1, bolt);
    };
    api.showMarks(caster, left, EFFECT);
    api.repeat(caster, POWER_OF_CHAOS.every, 1, bolt);
  },
};
