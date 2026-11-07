import { pct } from '../traits/format';
import { dist } from '../grid';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Mathilda (3g Storyweaver / Stargazer). Per star, index 0 = 1★.
export const UNFOLDING_TALE = {
  attackSpeed: [0.15, 0.25, 0.4], // for itself and its `allies` nearest allies
  allies: 2,
  seconds: 4,
  bolts: 3,
  ap: [3.1, 3.1, 4.1], // of magic attack, magic, per bolt
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
    `It and its ${UNFOLDING_TALE.allies} nearest allies gain +{as} attack speed for ${UNFOLDING_TALE.seconds}s. ` +
    `Then ${UNFOLDING_TALE.bolts} bolts fly at random enemies (a different one each while there are enough), ` +
    'each dealing {ap} of magic attack as magic damage.',
  damage: { ap: 'magic' },
  values: () => ({ as: UNFOLDING_TALE.attackSpeed.map(pct), ap: UNFOLDING_TALE.ap.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    // The nearest allies; a tie for the last place goes to a random one of them.
    const others = api.alliesOf(caster).filter((a) => a.id !== caster.id);
    const near = pickSpread(api, others, others.length).sort((a, b) => dist(caster, a) - dist(caster, b));
    const hasted = [caster, ...near.slice(0, UNFOLDING_TALE.allies)];
    for (const a of hasted) api.buff(a, [{ stat: 'attackSpeed', add: UNFOLDING_TALE.attackSpeed[i] }], UNFOLDING_TALE.seconds, 'unfoldingtale', caster);
    const raw = caster.stats.ap * UNFOLDING_TALE.ap[i];
    for (const enemy of pickSpread<SkillFighter>(api, api.enemiesOf(caster), UNFOLDING_TALE.bolts)) {
      if (enemy.hp <= 0) continue;
      api.showProjectile(caster, enemy, 0.2, 'unfoldingtale');
      api.hit(caster, enemy, raw, 'magic', 'unfoldingtale');
    }
  },
};
