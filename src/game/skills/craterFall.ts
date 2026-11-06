import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillDef } from './types';

// Wandering Bastion (Plane Wanderer, Dauntless): tick, tick, tick, boom. Per star, index 0 = 1★.
export const CRATER_FALL = {
  ticks: 3,
  every: 0.4, // seconds between ticks (and before the boom)
  tick: [0.6, 0.7, 1.5], // of attack, physical, per tick to each enemy in the area
  boom: [2, 2.4, 5], // of attack, physical, the explosion
};

export const craterFall: SkillDef = {
  id: 'craterfall',
  name: 'Crater Fall',
  desc:
    'Crashes down where the enemies are thickest. The tiles around where it lands smoulder: ' +
    `${CRATER_FALL.ticks} ticks, ${CRATER_FALL.every}s apart, of {tick} of attack, then they explode for {boom}. All physical.`,
  values: () => ({ tick: CRATER_FALL.tick.map(pct), boom: CRATER_FALL.boom.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    const area = around(caster); // fixed where it landed
    let n = 0;
    const tick = () => {
      const boom = n === CRATER_FALL.ticks;
      const raw = caster.stats.atk * (boom ? CRATER_FALL.boom[i] : CRATER_FALL.tick[i]);
      for (const e of enemiesOn(api, caster, area)) if (e.hp > 0) api.hit(caster, e, raw, 'physical', boom ? 'craterboom' : 'craterfall');
      n++;
    };
    tick();
    api.repeat(caster, CRATER_FALL.every, CRATER_FALL.ticks, tick);
  },
};
