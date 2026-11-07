import { pct } from '../traits/format';
import { around, enemiesOn, within } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillDef } from './types';

// Eidolon (7g Spectre). Per star, index 0 = 1★.
export const SPECTRAL_CATACLYSM = {
  impact: [1.6, 2, 5], // of attack, physical, enemies around where it lands
  delay: 0.4, // seconds from the landing to the blast
  radius: 3, // tiles the blast reaches out from the landing
  blast: [2.8, 3.4, 9], // of attack, physical, every enemy within the radius
};

export const spectralCataclysm: SkillDef = {
  id: 'spectralcataclysm',
  name: 'Spectral Cataclysm',
  desc:
    'Leaps into the thick of the enemy (the spot with the most of them around it). The impact hits the tiles around it for {impact} of attack, ' +
    `then ${SPECTRAL_CATACLYSM.delay}s later it explodes outwards, hitting every enemy within ${SPECTRAL_CATACLYSM.radius} tiles for {blast} of attack. All physical.`,
  damage: { impact: 'physical', blast: 'physical' },
  values: () => ({ impact: SPECTRAL_CATACLYSM.impact.map(pct), blast: SPECTRAL_CATACLYSM.blast.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    const center = { x: caster.x, y: caster.y }; // the blast goes off where it landed
    for (const e of enemiesOn(api, caster, around(center))) api.hit(caster, e, caster.stats.atk * SPECTRAL_CATACLYSM.impact[i], 'physical', 'spectralimpact');
    api.repeat(caster, SPECTRAL_CATACLYSM.delay, 1, () => {
      const raw = caster.stats.atk * SPECTRAL_CATACLYSM.blast[i];
      for (const e of enemiesOn(api, caster, within(center, SPECTRAL_CATACLYSM.radius))) if (e.hp > 0) api.hit(caster, e, raw, 'physical', 'spectralcataclysm');
    });
  },
};
