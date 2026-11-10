import { dist } from '../grid';
import { pct } from '../traits/format';
import { freeCellNextTo } from './dashStrike';
import { pickSpread } from './unfoldingTale';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Amon (Plane Wanderer, Hunter). Per star, index 0 = 1★.
export const STALKERS_MARK = {
  execute: [0.08, 0.1, 0.15], // passive: of max hp
  back: 0.5, // seconds away before it strikes
  atk: [4.5, 6, 22], // of attack, physical
  // 3★ only: after the strike, knives at this many random enemies, then a dash to the nearest and the strike again.
  knives: 3,
  knife: 8, // of attack, physical, per knife
  knifeFlight: 0.25, // seconds, for the look of it
};

// 3★: knives at random living enemies, then a dash to whoever is nearest and a second strike on it.
function knivesThenDash(api: SkillApi, caster: SkillFighter): void {
  // As Mathilda's bolts: a different enemy each while there are enough, then repeating.
  for (const e of pickSpread<SkillFighter>(api, api.enemiesOf(caster), STALKERS_MARK.knives)) {
    if (e.hp <= 0) continue;
    api.showProjectile(caster, e, STALKERS_MARK.knifeFlight, 'stalkersknife');
    api.hit(caster, e, caster.stats.atk * STALKERS_MARK.knife, 'physical', 'stalkersknife');
  }
  const next = api.nearestEnemy(caster);
  if (!next) return;
  if (dist(caster, next) > 1) {
    const spot = freeCellNextTo(api, next, caster);
    if (spot) api.dashTo(caster, spot);
  }
  api.hit(caster, next, caster.stats.atk * STALKERS_MARK.atk[caster.star - 1], 'physical', 'stalkersmark');
}

export const stalkersMark: SkillDef = {
  id: 'stalkersmark',
  name: "Stalker's Mark",
  desc:
    'Passive: an enemy on the tiles around it left below {execute} of its max HP is executed. ' +
    `Active: vanishes to the safest tile, so its attackers lose it, then ${STALKERS_MARK.back}s later strikes back at its prey for {atk} of attack as physical damage. ` +
    `At 3★ it then throws ${STALKERS_MARK.knives} knives at random enemies (a different one each while there are enough), {knife} of attack as physical damage each, then dashes to the nearest enemy and strikes it for {atk} of attack too.`,
  damage: { atk: 'physical', knife: 'physical' },
  values: () => ({ execute: STALKERS_MARK.execute.map(pct), atk: STALKERS_MARK.atk.map(pct), knife: [pct(STALKERS_MARK.knife)] }),
  executeBelow: STALKERS_MARK.execute,
  cast(api, caster, target) {
    let prey: SkillFighter | null = target.hp > 0 ? target : api.nearestEnemy(caster);
    const safe = api.safestCell(caster);
    if (safe.x !== caster.x || safe.y !== caster.y) api.dashTo(caster, safe);
    api.dropAggro(caster);
    api.busy(caster, true);
    api.repeat(caster, STALKERS_MARK.back, 1, () => {
      if (!prey || prey.hp <= 0) prey = api.nearestEnemy(caster);
      if (prey) {
        if (dist(caster, prey) > 1) {
          const spot = freeCellNextTo(api, prey, caster);
          if (spot) api.dashTo(caster, spot);
        }
        api.hit(caster, prey, caster.stats.atk * STALKERS_MARK.atk[caster.star - 1], 'physical', 'stalkersmark');
      }
      if (caster.star >= 3) knivesThenDash(api, caster);
      api.busy(caster, false);
    });
  },
};
