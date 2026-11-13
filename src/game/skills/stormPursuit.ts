import { dist } from '../grid';
import { pct } from '../traits/format';
import { around, coneAhead, enemiesOn, pathTo } from './areas';
import type { SkillDef, SkillFighter } from './types';

// Gufron (4g Skybringer / Hunter): throws a fan of knives that stick in the floor, then pulls them back to him.
// The first cast of a fight also leaps him onto the enemy doing the most damage in between. Per star, index 0 = 1★.
export const STORM_PURSUIT = {
  depth: 3, // the cone: 3 cells wide next to him, then 5, then 7
  ap: [0.9, 0.9, 2.35], // of magic attack, magic, to each enemy in the cone on the throw, and along the way on the pull
  throw: 0.25, // seconds the knives fly out
  jump: 0.3, // seconds after the throw that he leaps (first cast only)
  leap: 0.2, // how long the leap animates
  recall: 0.55, // seconds after the throw that he pulls the knives back
};

const EFFECT = 'stormpursuit';

export const stormPursuit: SkillDef = {
  id: 'stormpursuit',
  name: 'Storm Pursuit',
  desc:
    `Throws a fan of knives into a cone toward his target (${STORM_PURSUIT.depth} rows deep, widening): ` +
    'every enemy in it takes {ap} of magic attack as magic damage, and the knives stick in the floor. Then he pulls them back to him: ' +
    'every enemy in the cone or in their way is hit again. On his first cast each fight, he leaps beside the enemy that has dealt ' +
    'the most damage before the pull.',
  damage: { ap: 'magic' },
  values: () => ({ ap: STORM_PURSUIT.ap.map(pct) }),
  cast(api, caster, target) {
    const P = STORM_PURSUIT;
    const raw = caster.stats.ap * P.ap[caster.star - 1];
    const aim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!aim) return;
    const from = { x: caster.x, y: caster.y };
    // Thrown at whoever he's fighting. The cone is fixed when thrown; one knife sticks in each cell of its far
    // row (as far as the board goes).
    const cone = coneAhead(from, aim, P.depth);
    if (!cone.length) return;
    const far = Math.max(...cone.map((c) => dist(from, c)));
    const knives = cone.filter((c) => dist(from, c) === far);
    for (const k of knives) api.showProjectile(from, k, P.throw, 'stormknife');
    for (const e of enemiesOn(api, caster, cone)) if (e.hp > 0) api.hit(caster, e, raw, 'magic', EFFECT);
    // First cast only: committed until the leap (no walking off first), onto the enemy doing the most damage
    // (the nearest on a tie; his target if no one has dealt any yet).
    if (!caster.skill.leapt) {
      caster.skill.leapt = 1;
      api.busy(caster, true);
      api.repeat(caster, P.jump, 1, () => {
        api.busy(caster, false);
        const enemies = api.enemiesOf(caster);
        if (!enemies.length) return;
        const prey = enemies.reduce((a, b) => (b.dealt > a.dealt || (b.dealt === a.dealt && dist(caster, b) < dist(caster, a)) ? b : a), aim.hp > 0 ? aim : enemies[0]);
        const spots = around(prey).filter((c) => !api.occupant(c));
        if (!spots.length) return;
        const landing = spots.reduce((a, b) => (dist(caster, b) < dist(caster, a) ? b : a));
        api.showLeap(caster, landing, P.leap);
        api.dashTo(caster, landing, false);
      });
    }
    api.repeat(caster, P.recall, 1, () => {
      // The knives sweep back through the cone and fly straight to him: whoever is in the cone or in their way
      // is hit (once, however many knives pass).
      const struck = new Set<SkillFighter>(enemiesOn(api, caster, cone));
      for (const k of knives) {
        api.showProjectile(k, caster, P.throw, 'stormrecall');
        for (const e of enemiesOn(api, caster, pathTo(k, caster))) struck.add(e);
      }
      for (const e of struck) if (e.hp > 0) api.hit(caster, e, raw, 'magic', EFFECT);
    });
  },
};
