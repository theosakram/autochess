import { dist } from '../grid';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { freeCellNextTo } from './dashStrike';
import type { SkillDef, SkillFighter } from './types';

// Frank (3g Gustiwana / Weapon Master / Dauntless): the puppet master reels one in. Per star, index 0 = 1★.
export const PUPPET_SNARE = {
  hook: [0.55, 0.55, 0.85], // of attack, physical, to the hooked enemy
  shield: [0.1, 0.1, 0.12], // of its max hp, after the drag
  seconds: 4, // shield
  slam: [2.3, 2.3, 3.5], // of attack, physical, to each enemy around it
};

export const puppetSnare: SkillDef = {
  id: 'puppetsnare',
  name: 'Puppet Snare',
  desc:
    'Hooks the farthest enemy for {hook} of attack as physical damage and drags it beside itself, ' +
    `then gains a shield of {shield} of its max HP for ${PUPPET_SNARE.seconds}s and slams the ground: ` +
    'every enemy on the tiles around it takes {slam} of attack as physical damage.',
  damage: { hook: 'physical', slam: 'physical' },
  values: () => ({ hook: PUPPET_SNARE.hook.map(pct), shield: PUPPET_SNARE.shield.map(pct), slam: PUPPET_SNARE.slam.map(pct) }),
  cast(api, caster) {
    const P = PUPPET_SNARE;
    const i = caster.star - 1;
    const far = api.enemiesOf(caster).reduce<SkillFighter | null>((best, e) => (!best || dist(caster, e) > dist(caster, best) ? e : best), null);
    if (far) {
      api.showProjectile(caster, far, 0.2, 'puppetsnare');
      const killed = api.hit(caster, far, caster.stats.atk * P.hook[i], 'physical', 'puppetsnare');
      if (!killed && dist(caster, far) > 1) {
        const spot = freeCellNextTo(api, caster, far);
        if (spot) api.dashTo(far, spot);
      }
    }
    api.shield(caster, caster.maxHp * P.shield[i], P.seconds, 'puppetsnare');
    const raw = caster.stats.atk * P.slam[i];
    for (const e of enemiesOn(api, caster, around(caster))) api.hit(caster, e, raw, 'physical', 'puppetsnareslam');
  },
};
