import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Melina (5g Deadeye / Mooneater): a summoner. Per star, index 0 = 1★.
export const SPIRIT_ARCHERS = {
  archer: 'spiritarcher',
  attackSpeed: [0.2, 0.2, 1], // passive, from the start of the fight
  count: [1, 2, 6], // spirits at once
  landing: [1.6, 1.6, 2.05], // of attack, physical, to each enemy around a spirit as it lands
  mirror: [0.3, 0.3, 1.25], // of Melina's attack: each spirit repeats each of its basic attacks on the same target
  hp: 0.3, // of Melina's max hp, each
  seconds: 6, // each spirit lasts this long
};

export const spiritArchers: SkillDef = {
  id: 'spiritarchers',
  name: 'Spirit Archers',
  desc:
    'Passive: +{as} attack speed from the start of the fight. ' +
    'Active: summons spirit archers beside its target, up to {count} at once. Each lands with a blast: every enemy around it takes ' +
    `{landing} of attack as physical damage. A spirit lasts ${SPIRIT_ARCHERS.seconds}s (with ${pct(SPIRIT_ARCHERS.hp)} of Melina's max HP) ` +
    'and, whenever Melina hits, shoots the same target for {mirror} of its attack, critting when it crits. The spirits vanish if it falls.',
  damage: { landing: 'physical', mirror: 'attack' },
  values: () => ({
    as: SPIRIT_ARCHERS.attackSpeed.map(pct),
    count: SPIRIT_ARCHERS.count.map(String),
    landing: SPIRIT_ARCHERS.landing.map(pct),
    mirror: SPIRIT_ARCHERS.mirror.map(pct),
  }),
  atStart(api, caster) {
    api.buff(caster, [{ stat: 'attackSpeed', add: SPIRIT_ARCHERS.attackSpeed[caster.star - 1] }], Infinity, 'spiritarchers', caster);
  },
  cast(api, caster, target) {
    const S = SPIRIT_ARCHERS;
    const i = caster.star - 1;
    const at = target.hp > 0 ? target : api.nearestEnemy(caster);
    for (let n = api.minionsOf(caster).length; n < S.count[i]; n++) {
      const spirit = api.summon(caster, S.archer, { hpShare: S.hp, mirror: S.mirror[i], ...(at && { at: { x: at.x, y: at.y } }) });
      if (!spirit) break;
      const raw = caster.stats.atk * S.landing[i];
      for (const e of enemiesOn(api, caster, around(spirit))) if (e.hp > 0) api.hit(caster, e, raw, 'physical', 'spiritlanding');
      api.repeat(caster, S.seconds, 1, () => api.dismiss(spirit));
    }
  },
};
