import { pct } from '../traits/format';
import { enemiesOn, lineThrough } from './areas';
import type { SkillDef, SkillFighter } from './types';

// Gourd (4g Spectre / Mage). Per star, index 0 = 1★.
export const ETHER_BEAM = {
  ticks: 12,
  every: 0.15, // seconds between ticks
  ap: [1.2, 1.2, 3.2], // of magic attack, magic, per tick to each enemy on the line
};

export const etherBeam: SkillDef = {
  id: 'etherbeam',
  name: 'Ether Beam',
  desc:
    `Channels a beam through its target to the edge of the board, following it as it moves (and turning to the nearest enemy if it falls): ` +
    `${ETHER_BEAM.ticks} times, ${ETHER_BEAM.every}s apart, every enemy on the line takes {ap} of magic attack as magic damage.`,
  damage: { ap: 'magic' },
  values: () => ({ ap: ETHER_BEAM.ap.map(pct) }),
  cast(api, caster, target) {
    let aim: SkillFighter | null = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!aim) return;
    const raw = caster.stats.ap * ETHER_BEAM.ap[caster.star - 1];
    let n = 0;
    // Every tick it re-aims through a living enemy where it stands now (its target, else the nearest),
    // so the beam never fires into an empty square while there's anyone left.
    const tick = () => {
      if (!aim || aim.hp <= 0) aim = api.nearestEnemy(caster);
      if (aim && (aim.x !== caster.x || aim.y !== caster.y)) {
        const line = lineThrough(caster, aim);
        api.showProjectile(caster, line[line.length - 1] ?? aim, ETHER_BEAM.every, 'etherbeam');
        for (const e of enemiesOn(api, caster, line)) if (e.hp > 0) api.hit(caster, e, raw, 'magic', 'etherbeam');
      }
      if (++n >= ETHER_BEAM.ticks) api.busy(caster, false);
    };
    api.busy(caster, true);
    tick();
    api.repeat(caster, ETHER_BEAM.every, ETHER_BEAM.ticks - 1, tick);
  },
};
