import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Wan (3g Dragon Altar / Deadeye). Per star, index 0 = 1★.
export const DRAGON_LANCE = {
  atk: [0.95, 0.95, 1.5], // of attack, physical: the enhanced attack, and the blast around its target
};

export const dragonLance: SkillDef = {
  id: 'dragonlance',
  name: 'Dragon Lance',
  desc:
    'Its next attack is enhanced: it deals {atk} of attack as physical damage, ' +
    'then the target explodes: every enemy around it takes the same damage.',
  damage: { atk: 'physical' },
  values: () => ({ atk: DRAGON_LANCE.atk.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const raw = caster.stats.atk * DRAGON_LANCE.atk[caster.star - 1];
    const at = { x: victim.x, y: victim.y };
    api.basicHit(caster, victim, raw, 'physical', 'dragonlance');
    // It explodes where it stood, even if the hit killed it.
    for (const e of enemiesOn(api, caster, around(at))) if (e.hp > 0) api.hit(caster, e, raw, 'physical', 'dragonlanceblast');
  },
};
