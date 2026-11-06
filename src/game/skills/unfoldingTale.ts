import { pct } from '../traits/format';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Chronicler (3g Storyweaver). Per star, index 0 = 1★.
export const UNFOLDING_TALE = {
  attackSpeed: [0.3, 0.4, 0.7], // for itself and `allies` random allies
  allies: 2,
  seconds: 5,
  bolts: 3,
  ap: [1.4, 1.7, 3.4], // of magic attack, magic, per bolt
};

// `count` picks from `from`, all different while there are enough, then repeating.
export function pickSpread<T>(api: SkillApi, from: T[], count: number): T[] {
  const picks: T[] = [];
  let left = [...from];
  for (let i = 0; i < count && from.length; i++) {
    if (!left.length) left = [...from];
    picks.push(left.splice(api.random(left.length), 1)[0]);
  }
  return picks;
}

export const unfoldingTale: SkillDef = {
  id: 'unfoldingtale',
  name: 'Unfolding Tale',
  desc:
    `It and ${UNFOLDING_TALE.allies} random allies gain +{as} attack speed for ${UNFOLDING_TALE.seconds}s. ` +
    `Then ${UNFOLDING_TALE.bolts} bolts fly at random enemies (a different one each while there are enough), ` +
    'each dealing {ap} of magic attack as magic damage.',
  values: () => ({ as: UNFOLDING_TALE.attackSpeed.map(pct), ap: UNFOLDING_TALE.ap.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const others = api.alliesOf(caster).filter((a) => a.id !== caster.id);
    const hasted = [caster, ...pickSpread(api, others, Math.min(UNFOLDING_TALE.allies, others.length))];
    for (const a of hasted) api.buff(a, [{ stat: 'attackSpeed', add: UNFOLDING_TALE.attackSpeed[i] }], UNFOLDING_TALE.seconds, 'unfoldingtale', caster);
    const raw = caster.stats.ap * UNFOLDING_TALE.ap[i];
    for (const enemy of pickSpread<SkillFighter>(api, api.enemiesOf(caster), UNFOLDING_TALE.bolts)) {
      if (enemy.hp <= 0) continue;
      api.showProjectile(caster, enemy, 0.2, 'unfoldingtale');
      api.hit(caster, enemy, raw, 'magic', 'unfoldingtale');
    }
  },
};
