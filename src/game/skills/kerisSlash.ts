import { dist, GRID_H, GRID_W } from '../grid';
import { pct } from '../traits/format';
import { enemiesOn, facingStrip } from './areas';
import type { SkillDef } from './types';

// Ken Arok (Plane Wanderer, Weapon Master). Per star, index 0 = 1★.
export const KERIS_SLASH = {
  atk: [3.6, 4.8, 10], // of attack, physical, to each enemy slashed
  depth: 2, // rows the slash reaches ahead of him (3 wide); at 3★ it reaches the whole board
};

export const kerisSlash: SkillDef = {
  id: 'kerisslash',
  name: 'Cursed Keris',
  desc:
    `One slash at the 3x${KERIS_SLASH.depth} in front of him (3 wide, ${KERIS_SLASH.depth} deep, toward his target), dealing {atk} of attack ` +
    'as physical damage to each enemy in it. At 3★ the slash sweeps the entire board: every enemy is hit.',
  damage: { atk: 'physical' },
  values: () => ({ atk: KERIS_SLASH.atk.map(pct) }),
  cast(api, caster, target) {
    const i = caster.star - 1;
    let foes;
    if (caster.star >= 3) {
      foes = api.enemiesOf(caster);
      // The look: one huge crescent across the whole board.
      api.showProjectile(caster, { x: (GRID_W - 1) / 2, y: (GRID_H - 1) / 2 }, 0.45, 'kerisslashall');
    } else {
      const facing = target.hp > 0 ? target : api.nearestEnemy(caster);
      if (!facing) return;
      // The strip toward his target, cut to its first `depth` rows: 3 wide, 2 deep.
      const block = facingStrip(caster, facing).filter((p) => dist(caster, p) <= KERIS_SLASH.depth);
      foes = enemiesOn(api, caster, block);
      // The look: a half-moon slash over the block (its middle), facing away from him.
      if (block.length) {
        const mid = { x: block.reduce((n, p) => n + p.x, 0) / block.length, y: block.reduce((n, p) => n + p.y, 0) / block.length };
        api.showProjectile(caster, mid, 0.3, 'kerisslash');
      }
    }
    for (const e of foes) api.hit(caster, e, caster.stats.atk * KERIS_SLASH.atk[i], 'physical', 'kerisslash');
  },
};
