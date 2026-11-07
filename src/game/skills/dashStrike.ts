import { dist, GRID_H, GRID_W, type Point } from '../grid';
import type { DamageType } from '../stats';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Who a dash strike goes after. Ties (and a fight's first seconds, before anyone has dealt damage)
// go to the nearest.
export const PICKERS = {
  weakest: { label: 'the enemy with the lowest HP', score: (e: SkillFighter, _f: SkillFighter) => -e.hp },
  deadliest: { label: 'the enemy that has dealt the most damage', score: (e: SkillFighter, _f: SkillFighter) => e.dealt },
  farthest: { label: 'the farthest enemy', score: (e: SkillFighter, f: SkillFighter) => dist(f, e) },
};

export function pickEnemy(api: SkillApi, f: SkillFighter, by: keyof typeof PICKERS): SkillFighter | null {
  const score = PICKERS[by].score;
  return api.enemiesOf(f).reduce<SkillFighter | null>((best, e) => {
    if (!best) return e;
    const [a, b] = [score(e, f), score(best, f)];
    return a > b || (a === b && dist(f, e) < dist(f, best)) ? e : best;
  }, null);
}

// A free cell touching `target`, the one closest to `from`; null if it's surrounded.
export function freeCellNextTo(api: SkillApi, target: Point, from: Point): Point | null {
  let best: Point | null = null;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const p = { x: target.x + dx, y: target.y + dy };
      if ((!dx && !dy) || p.x < 0 || p.y < 0 || p.x >= GRID_W || p.y >= GRID_H || api.occupant(p)) continue;
      if (!best || dist(from, p) < dist(from, best)) best = p;
    }
  }
  return best;
}

// Per star, index 0 = 1★.
export interface DashStrike {
  id: string;
  name: string;
  target: keyof typeof PICKERS;
  scale: number[]; // of `stat`
  stat: 'atk' | 'ap';
  type: DamageType;
  area?: true; // hits every enemy on the tiles around where it lands, not just the target
}

// Dashes beside the chosen enemy and strikes it once (a skill hit); with `area`, strikes every enemy
// on the 8 tiles around where it lands instead. Already beside it, or it's boxed in: strikes from where it stands.
export function dashStrike(cfg: DashStrike): SkillDef {
  const statName = cfg.stat === 'ap' ? 'magic attack' : 'attack';
  return {
    id: cfg.id,
    name: cfg.name,
    desc: cfg.area
      ? `Dashes to ${PICKERS[cfg.target].label}, then strikes every enemy within 1 tile of her for {scale} of ${statName} as ${cfg.type} damage.`
      : `Dashes to ${PICKERS[cfg.target].label} and strikes it for {scale} of ${statName} as ${cfg.type} damage.`,
    damage: { scale: cfg.type },
    values: () => ({ scale: cfg.scale.map(pct) }),
    cast(api, caster) {
      const victim = pickEnemy(api, caster, cfg.target);
      if (!victim) return;
      const landing = freeCellNextTo(api, victim, caster);
      if (landing && dist(caster, victim) > 1) api.dashTo(caster, landing);
      const raw = caster.stats[cfg.stat] * cfg.scale[caster.star - 1];
      const struck = cfg.area ? enemiesOn(api, caster, around(caster)) : [victim];
      if (cfg.area && !struck.includes(victim) && dist(caster, victim) <= 1) struck.push(victim);
      for (const e of struck) if (e.hp > 0) api.hit(caster, e, raw, cfg.type, cfg.id);
    },
  };
}
