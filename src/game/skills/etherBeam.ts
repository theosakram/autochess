import { pct } from '../traits/format';
import { enemiesOn } from './areas';
import { dashLine } from './phantomExecution';
import type { SkillDef } from './types';

// Ether Sage (4g Mage). Per star, index 0 = 1★.
export const ETHER_BEAM = {
  ticks: 12,
  every: 0.15, // seconds between ticks
  ap: [0.3, 0.36, 0.75], // of magic attack, magic, per tick to each enemy on the line
};

export const etherBeam: SkillDef = {
  id: 'etherbeam',
  name: 'Ether Beam',
  desc:
    `Channels a beam through its target to the edge of the board: ${ETHER_BEAM.ticks} times, ${ETHER_BEAM.every}s apart, ` +
    'every enemy on the line takes {ap} of magic attack as magic damage.',
  values: () => ({ ap: ETHER_BEAM.ap.map(pct) }),
  cast(api, caster, target) {
    const aim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!aim) return;
    // The line is set when it starts; whoever stands on it takes each tick.
    const line = dashLine(caster, aim, 99);
    const end = line[line.length - 1] ?? aim;
    const raw = caster.stats.ap * ETHER_BEAM.ap[caster.star - 1];
    let n = 0;
    const tick = () => {
      api.showProjectile(caster, end, ETHER_BEAM.every, 'etherbeam');
      for (const e of enemiesOn(api, caster, line)) if (e.hp > 0) api.hit(caster, e, raw, 'magic', 'etherbeam');
      if (++n >= ETHER_BEAM.ticks) api.busy(caster, false);
    };
    api.busy(caster, true);
    tick();
    api.repeat(caster, ETHER_BEAM.every, ETHER_BEAM.ticks - 1, tick);
  },
};
