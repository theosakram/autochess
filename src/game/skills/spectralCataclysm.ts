import { pct } from '../traits/format';
import { around, enemiesOn, within } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillDef, SkillFighter } from './types';

// Boss Alpha (7g Spectre). Per star, index 0 = 1★.
export const SPECTRAL_CATACLYSM = {
  impact: [1.6, 2, 5], // of the higher of attack and magic attack, enemies around where it lands
  delay: 0.4, // seconds from the landing to the blast
  radius: 3, // tiles the blast reaches out from the landing
  blast: [2.8, 3.4, 9], // of the same, every enemy within the radius
};

// Scales off whichever is higher, attack or magic attack, and deals that kind of damage (physical on a tie).
const power = (c: SkillFighter) =>
  c.stats.ap > c.stats.atk ? { stat: c.stats.ap, type: 'magic' as const } : { stat: c.stats.atk, type: 'physical' as const };

export const spectralCataclysm: SkillDef = {
  id: 'spectralcataclysm',
  name: 'Spectral Cataclysm',
  desc:
    'Leaps into the thick of the enemy (the spot with the most of them around it). The impact hits the tiles around it for {impact} of its higher of attack and magic attack, ' +
    `then ${SPECTRAL_CATACLYSM.delay}s later it explodes outwards, hitting every enemy within ${SPECTRAL_CATACLYSM.radius} tiles for {blast} of its higher of attack and magic attack. ` +
    'Magic damage if its magic attack is the higher, else physical.',
  damage: { impact: 'higher', blast: 'higher' },
  values: () => ({ impact: SPECTRAL_CATACLYSM.impact.map(pct), blast: SPECTRAL_CATACLYSM.blast.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    const center = { x: caster.x, y: caster.y }; // the blast goes off where it landed
    const now = power(caster);
    for (const e of enemiesOn(api, caster, around(center))) api.hit(caster, e, now.stat * SPECTRAL_CATACLYSM.impact[i], now.type, 'spectralimpact');
    api.repeat(caster, SPECTRAL_CATACLYSM.delay, 1, () => {
      const { stat, type } = power(caster);
      for (const e of enemiesOn(api, caster, within(center, SPECTRAL_CATACLYSM.radius))) if (e.hp > 0) api.hit(caster, e, stat * SPECTRAL_CATACLYSM.blast[i], type, 'spectralcataclysm');
    });
  },
};
