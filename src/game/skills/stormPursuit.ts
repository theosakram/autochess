import { dist } from '../grid';
import { pct } from '../traits/format';
import { coneAhead, enemiesOn } from './areas';
import type { SkillDef, SkillFighter } from './types';

// Gufron (4g Skybringer / Hunter): a fan of knives thrown into a cone ahead, then called back. Per star, index 0 = 1★.
export const STORM_PURSUIT = {
  depth: 3, // the cone: 3 cells wide next to him, then 5, then 7
  ap: [0.9, 0.9, 2.35], // of magic attack, magic, to each enemy in the cone, each way
  recall: 0.4, // seconds before they fly back
};

export const stormPursuit: SkillDef = {
  id: 'stormpursuit',
  name: 'Storm Pursuit',
  desc:
    `Throws a fan of knives into a cone opening out from him toward his target (${STORM_PURSUIT.depth} rows deep, widening): every enemy in it ` +
    `takes {ap} of magic attack as magic damage. Then he recalls them, and they hit everyone in the cone again on the way back.`,
  damage: { ap: 'magic' },
  values: () => ({ ap: STORM_PURSUIT.ap.map(pct) }),
  cast(api, caster, target) {
    const raw = caster.stats.ap * STORM_PURSUIT.ap[caster.star - 1];
    const from = { x: caster.x, y: caster.y };
    const toward = target.hp > 0 ? target : (api.nearestEnemy(caster) ?? target);
    // The cone is fixed when thrown; whoever stands in it when the knives pass is hit (once per pass).
    const cone = coneAhead(from, toward, STORM_PURSUIT.depth);
    if (!cone.length) return;
    // One knife to each cell of the cone's far row (as far as the board goes), for the look of it.
    const far = Math.max(...cone.map((c) => dist(from, c)));
    const ends = cone.filter((c) => dist(from, c) === far);
    const pass = (back: boolean) => {
      for (const end of ends) api.showProjectile(back ? end : from, back ? from : end, STORM_PURSUIT.recall, 'stormpursuit');
      for (const e of enemiesOn(api, caster, cone) as SkillFighter[]) if (e.hp > 0) api.hit(caster, e, raw, 'magic', 'stormpursuit');
    };
    pass(false);
    api.repeat(caster, STORM_PURSUIT.recall, 1, () => pass(true));
  },
};
