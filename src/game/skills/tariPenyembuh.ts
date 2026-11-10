import { pct } from '../traits/format';
import { loveBeam } from './areas';
import type { SkillDef } from './types';

// Angela (2g Gustiwana / Scavenger): a healer. Per star, index 0 = 1★.
export const TARI_PENYEMBUH = {
  heal: [1.6, 1.6, 2.2], // of its magic attack, healed to each ally on the beam
  ap: [1.6, 1.6, 2.2], // of its magic attack, magic damage to each enemy on the beam
};

export const tariPenyembuh: SkillDef = {
  id: 'taripenyembuh',
  name: 'Love Beam',
  desc:
    'Fires a Love Beam through its target to the edge of the board, 2 rows wide: allies in its path are healed {heal} of magic attack, ' +
    'enemies in it take {ap} of magic attack as magic damage.',
  damage: { ap: 'magic' },
  values: () => ({ heal: TARI_PENYEMBUH.heal.map(pct), ap: TARI_PENYEMBUH.ap.map(pct) }),
  cast(api, caster, target) {
    const aim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!aim || (aim.x === caster.x && aim.y === caster.y)) return;
    const i = caster.star - 1;
    for (const c of loveBeam(api, caster, aim)) {
      const there = api.occupant(c);
      if (!there) continue;
      if (there.side === caster.side) api.heal(there, caster.stats.ap * TARI_PENYEMBUH.heal[i], caster);
      else api.hit(caster, there, caster.stats.ap * TARI_PENYEMBUH.ap[i], 'magic', 'lovebeam');
    }
  },
};
