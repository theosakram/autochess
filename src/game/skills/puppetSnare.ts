import { dist } from '../grid';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { freeCellNextTo } from './dashStrike';
import type { SkillDef, SkillFighter } from './types';

// Dalang (3g Dauntless): the puppet master reels one in. Per star, index 0 = 1★.
export const PUPPET_SNARE = {
  atk: [1.6, 1.9, 4], // of attack, physical, to each enemy around it after the pull
};

export const puppetSnare: SkillDef = {
  id: 'puppetsnare',
  name: 'Puppet Snare',
  desc:
    'Throws a snare at the farthest enemy and drags it beside itself, ' +
    'then strikes every enemy on the tiles around it for {atk} of attack as physical damage.',
  values: () => ({ atk: PUPPET_SNARE.atk.map(pct) }),
  cast(api, caster) {
    const far = api.enemiesOf(caster).reduce<SkillFighter | null>((best, e) => (!best || dist(caster, e) > dist(caster, best) ? e : best), null);
    if (!far) return;
    if (dist(caster, far) > 1) {
      api.showProjectile(caster, far, 0.2, 'puppetsnare');
      const spot = freeCellNextTo(api, caster, far);
      if (spot) api.dashTo(far, spot);
    }
    const raw = caster.stats.atk * PUPPET_SNARE.atk[caster.star - 1];
    for (const e of enemiesOn(api, caster, around(caster))) api.hit(caster, e, raw, 'physical', 'puppetsnare');
  },
};
