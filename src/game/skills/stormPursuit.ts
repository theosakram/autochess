import { GRID_H, GRID_W, type Point } from '../grid';
import { pct } from '../traits/format';
import { enemiesOn } from './areas';
import type { SkillDef, SkillFighter } from './types';

// Gufron (4g Skybringer / Hunter): a fan of knives, thrown out and called back. Per star, index 0 = 1★.
export const STORM_PURSUIT = {
  knives: 7,
  reach: 3, // tiles each knife flies
  ap: [0.9, 0.9, 2.35], // of magic attack, magic, to each enemy a knife passes, each way
  recall: 0.4, // seconds before they fly back
};

// The 8 directions, minus straight back (away from the enemy): 7 knives fanning out.
function directions(side: 0 | 1): Point[] {
  const back = side === 0 ? 1 : -1;
  const dirs: Point[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && !(dx === 0 && dy === back)) dirs.push({ x: dx, y: dy });
  return dirs;
}

// The cells one knife crosses from `from` in direction `d`, up to `reach`, stopped at the board's edge.
export function knifePath(from: Point, d: Point, reach = STORM_PURSUIT.reach): Point[] {
  const cells: Point[] = [];
  for (let n = 1; n <= reach; n++) {
    const p = { x: from.x + d.x * n, y: from.y + d.y * n };
    if (p.x < 0 || p.y < 0 || p.x >= GRID_W || p.y >= GRID_H) break;
    cells.push(p);
  }
  return cells;
}

export const stormPursuit: SkillDef = {
  id: 'stormpursuit',
  name: 'Storm Pursuit',
  desc:
    `Throws ${STORM_PURSUIT.knives} knives fanning out around it, ${STORM_PURSUIT.reach} tiles each: every enemy a knife passes ` +
    `takes {ap} of magic attack as magic damage. Then it recalls them, and they hit again on the way back.`,
  damage: { ap: 'magic' },
  values: () => ({ ap: STORM_PURSUIT.ap.map(pct) }),
  cast(api, caster) {
    const raw = caster.stats.ap * STORM_PURSUIT.ap[caster.star - 1];
    const from = { x: caster.x, y: caster.y };
    // The paths are fixed when thrown; whoever stands on one when a knife passes is hit (once per knife per pass).
    const paths = directions(caster.side as 0 | 1).slice(0, STORM_PURSUIT.knives).map((d) => knifePath(from, d)).filter((p) => p.length);
    const pass = (back: boolean) => {
      for (const path of paths) {
        const end = path[path.length - 1];
        api.showProjectile(back ? end : from, back ? from : end, STORM_PURSUIT.recall, 'stormpursuit');
        for (const e of enemiesOn(api, caster, path) as SkillFighter[]) if (e.hp > 0) api.hit(caster, e, raw, 'magic', 'stormpursuit');
      }
    };
    pass(false);
    api.repeat(caster, STORM_PURSUIT.recall, 1, () => pass(true));
  },
};
