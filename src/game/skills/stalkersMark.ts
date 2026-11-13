import type { Point } from '../grid';
import { pct } from '../traits/format';
import { lineThrough } from './areas';
import type { SkillDef } from './types';

// Amon (Plane Wanderer, Hunter). Per star, index 0 = 1★.
export const STALKERS_MARK = {
  execute: [0.08, 0.1, 0.15], // passive: of max hp
  // Active: knives in every direction (`perEnemy` at each living enemy, at least `knives` in all), then every
  // knife turns and homes in on his target. 3★ throws twice as many, as sharp shards.
  knives: [8, 8, 16],
  perEnemy: [1, 1, 2],
  out: [0.8, 0.95, 6], // of attack, physical, to each enemy a knife hits on the way out
  home: [0.55, 0.6, 7], // of attack, physical, to his target per knife homing in
  throw: 0.25, // seconds the knives fly out
  homeAfter: 0.4, // seconds after the throw that they turn and home in
  homeFlight: 0.3, // seconds they take to home in
};

const COMPASS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]] as const;

export const stalkersMark: SkillDef = {
  id: 'stalkersmark',
  name: "Stalker's Mark",
  desc:
    'Passive: an enemy on the tiles around it left below {execute} of its max HP is executed. ' +
    'Active: throws {knives} knives in every direction (or more, if there are more enemies): {perEnemy} at each enemy, each dealing {out} of attack ' +
    'as physical damage. Then every knife turns and homes in on its target, each dealing {home} of attack as physical damage. ' +
    'At 3★ they are sharp shards, twice as many.',
  damage: { out: 'physical', home: 'physical' },
  values: () => ({
    execute: STALKERS_MARK.execute.map(pct),
    knives: STALKERS_MARK.knives.map(String),
    perEnemy: STALKERS_MARK.perEnemy.map(String),
    out: STALKERS_MARK.out.map(pct),
    home: STALKERS_MARK.home.map(pct),
  }),
  executeBelow: STALKERS_MARK.execute,
  cast(api, caster, target) {
    const P = STALKERS_MARK;
    const i = caster.star - 1;
    const struck = api.enemiesOf(caster);
    if (!struck.length) return;
    // 3★ shards: only the look differs.
    const [throwLook, homeLook] = caster.star >= 3 ? ['stalkersshard', 'stalkersshardhome'] : ['stalkersthrow', 'stalkershome'];
    // Where each knife ends up, to home in from: where its enemy stood, or the board's edge for the rest.
    const knives: Point[] = [];
    for (const e of struck) {
      for (let n = 0; n < P.perEnemy[i]; n++) {
        knives.push({ x: e.x, y: e.y });
        api.showProjectile(caster, e, P.throw, throwLook);
        if (e.hp > 0) api.hit(caster, e, caster.stats.atk * P.out[i], 'physical', 'stalkersknife');
      }
    }
    // The rest fly out to the edge: first the compass directions no enemy knife went, then round all of them again.
    const from = { x: caster.x, y: caster.y };
    const used = new Set(knives.map((k) => `${Math.sign(k.x - from.x)},${Math.sign(k.y - from.y)}`));
    const edges = [...COMPASS.filter(([dx, dy]) => !used.has(`${dx},${dy}`)), ...COMPASS]
      .map(([dx, dy]) => lineThrough(from, { x: from.x + dx, y: from.y + dy }).at(-1))
      .filter((p): p is Point => !!p); // directions off the board have none
    for (let n = 0; edges.length && knives.length < P.knives[i]; n++) {
      const edge = edges[n % edges.length];
      api.showProjectile(caster, edge, P.throw, throwLook);
      knives.push(edge);
    }
    let prey = target.hp > 0 ? target : null;
    api.repeat(caster, P.homeAfter, 1, () => {
      if (!prey || prey.hp <= 0) prey = api.nearestEnemy(caster);
      for (const k of knives) {
        if (!prey || prey.hp <= 0) prey = api.nearestEnemy(caster); // a kill passes the rest on
        if (!prey) return;
        api.showProjectile(k, prey, P.homeFlight, homeLook);
        api.hit(caster, prey, caster.stats.atk * P.home[i], 'physical', 'stalkersmark');
      }
    });
  },
};
