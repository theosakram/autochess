import { dist, GRID_H, GRID_W, type Point } from '../grid';
import type { DamageType } from '../stats';
import { pct } from '../traits/format';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Who a dash strike goes after. Ties (and a fight's first seconds, before anyone has dealt damage)
// go to the nearest.
export const PICKERS = {
  weakest: { label: 'the enemy with the lowest HP', score: (e: SkillFighter) => -e.hp },
  deadliest: { label: 'the enemy that has dealt the most damage', score: (e: SkillFighter) => e.dealt },
};

export function pickEnemy(api: SkillApi, f: SkillFighter, by: keyof typeof PICKERS): SkillFighter | null {
  const score = PICKERS[by].score;
  return api.enemiesOf(f).reduce<SkillFighter | null>((best, e) => {
    if (!best) return e;
    const [a, b] = [score(e), score(best)];
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
}

// Dashes beside the chosen enemy and strikes it once (a skill hit). Already beside it, or it's
// boxed in: strikes from where it stands.
export function dashStrike(cfg: DashStrike): SkillDef {
  const statName = cfg.stat === 'ap' ? 'magic attack' : 'attack';
  return {
    id: cfg.id,
    name: cfg.name,
    desc: `Dashes to ${PICKERS[cfg.target].label} and strikes it for {scale} of ${statName} as ${cfg.type} damage.`,
    values: () => ({ scale: cfg.scale.map(pct) }),
    cast(api, caster) {
      const victim = pickEnemy(api, caster, cfg.target);
      if (!victim) return;
      const landing = freeCellNextTo(api, victim, caster);
      if (landing && dist(caster, victim) > 1) api.dashTo(caster, landing);
      api.hit(caster, victim, caster.stats[cfg.stat] * cfg.scale[caster.star - 1], cfg.type, cfg.id);
    },
  };
}
