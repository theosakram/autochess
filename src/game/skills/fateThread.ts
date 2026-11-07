import { pct } from '../traits/format';
import { pickSpread } from './unfoldingTale';
import type { SkillDef } from './types';

// Novaria (Plane Wanderer, Stargazer). Per star, index 0 = 1★.
export const FATE_THREAD = {
  linked: [2, 3, 4], // enemies linked at the start of combat
  share: [0.3, 0.4, 0.5], // of the damage a linked enemy takes, dealt to each other linked enemy
  ap: [3.5, 3.8, 8], // active: of magic attack, magic, one target
};

export const fateThread: SkillDef = {
  id: 'fatethread',
  name: 'Fate Thread',
  desc:
    'Passive: when combat starts, it threads the fates of {linked} enemies together: while it lives, damage any of them takes ' +
    'is shared, {share} of it dealt to each of the others. Active: strikes its target for {ap} of magic attack as magic damage.',
  damage: { ap: 'magic' },
  values: () => ({
    linked: FATE_THREAD.linked.map((n) => (n === Infinity ? 'all' : String(n))),
    share: FATE_THREAD.share.map(pct),
    ap: FATE_THREAD.ap.map(pct),
  }),
  atStart(api, caster) {
    const i = caster.star - 1;
    const enemies = api.enemiesOf(caster);
    const count = Math.min(FATE_THREAD.linked[i], enemies.length);
    if (count < 2) return;
    api.link(caster, pickSpread(api, enemies, count), FATE_THREAD.share[i]);
  },
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (victim) api.hit(caster, victim, caster.stats.ap * FATE_THREAD.ap[caster.star - 1], 'magic', 'fatethread');
  },
};
