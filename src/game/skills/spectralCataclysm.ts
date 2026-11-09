import { pct } from '../traits/format';
import { around, enemiesOn, within } from './areas';
import { densestDrop } from './mythMadeFlesh';
import { adaptivePower } from '../stats';
import type { SkillDef } from './types';

// Boss Alpha (7g Spectre). Per star, index 0 = 1★.
export const SPECTRAL_CATACLYSM = {
  impact: [1.6, 2, 5], // of the higher of attack and magic attack, enemies around where it lands
  delay: 0.4, // seconds from the landing to the blast
  radius: 3, // tiles the blast reaches out from the landing
  blast: [2.8, 3.4, 9], // of the same, every enemy within the radius
};

export const spectralCataclysm: SkillDef = {
  id: 'spectralcataclysm',
  name: 'Spectral Cataclysm',
  desc:
    'Leaps into the thick of the enemy (the spot with the most of them around it). The impact hits the tiles around it for {impact} of its higher of attack and magic attack, ' +
    `then ${SPECTRAL_CATACLYSM.delay}s later it explodes outwards, hitting every enemy within ${SPECTRAL_CATACLYSM.radius} tiles for {blast} of its higher of attack and magic attack. ` +
    'Adaptive damage: magic if its magic attack is the higher, else physical.',
  damage: { impact: 'adaptive', blast: 'adaptive' },
  values: () => ({ impact: SPECTRAL_CATACLYSM.impact.map(pct), blast: SPECTRAL_CATACLYSM.blast.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    const center = { x: caster.x, y: caster.y }; // the blast goes off where it landed
    for (const e of enemiesOn(api, caster, around(center))) api.hit(caster, e, adaptivePower(caster.stats) * SPECTRAL_CATACLYSM.impact[i], 'adaptive', 'spectralimpact');
    api.repeat(caster, SPECTRAL_CATACLYSM.delay, 1, () => {
      for (const e of enemiesOn(api, caster, within(center, SPECTRAL_CATACLYSM.radius)))
        if (e.hp > 0) api.hit(caster, e, adaptivePower(caster.stats) * SPECTRAL_CATACLYSM.blast[i], 'adaptive', 'spectralcataclysm');
    });
  },
};
