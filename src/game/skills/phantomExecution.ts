import { GRID_H, GRID_W, type Point } from '../grid';
import { pct } from '../traits/format';
import type { SkillDef, SkillFighter } from './types';

// Per star, index 0 = 1★.
export const PHANTOM_EXECUTION = {
  atk: [1.7, 1.95, 4.5], // of total physical attack, to every enemy along a dash
  maxDashes: 3, // the 1st cast dashes once, each later cast once more, up to this
  dashLength: 4, // cells
  dashSeconds: 0.2, // how long one dash takes, for the damage reduction
  dashReduction: 0.15, // less damage taken while dashing
  phantomAfter: 3, // dashes in this fight before every dash leaves a Phantom
};

// The straight line from `from` through `toward` (8-way), up to `length` cells or the board edge.
export function dashLine(from: Point, toward: Point, length: number): Point[] {
  const dx = Math.sign(toward.x - from.x);
  const dy = Math.sign(toward.y - from.y);
  const line: Point[] = [];
  for (let i = 1; i <= length; i++) {
    const p = { x: from.x + dx * i, y: from.y + dy * i };
    if (p.x < 0 || p.y < 0 || p.x >= GRID_W || p.y >= GRID_H) break;
    line.push(p);
  }
  return line;
}

export const phantomExecution: SkillDef = {
  id: 'phantomexecution',
  name: 'Phantom Execution',
  desc:
    `Dashes through the nearest enemy, dealing {atk} of attack as physical damage to every enemy along the path. ` +
    `Each cast adds one more dash, up to ${PHANTOM_EXECUTION.maxDashes}. Takes ${pct(PHANTOM_EXECUTION.dashReduction)} less damage while dashing. ` +
    `Passive: after ${PHANTOM_EXECUTION.phantomAfter} dashes, every dash leaves a Phantom that deals the same damage along its path.`,
  values: () => ({ atk: PHANTOM_EXECUTION.atk.map(pct) }),
  cast(api, caster) {
    const P = PHANTOM_EXECUTION;
    caster.skill.casts = (caster.skill.casts ?? 0) + 1;
    const dashes = Math.min(caster.skill.casts, P.maxDashes);
    api.guard(caster, dashes * P.dashSeconds, P.dashReduction);
    const raw = caster.stats.atk * P.atk[caster.star - 1];

    for (let i = 0; i < dashes; i++) {
      const target = api.nearestEnemy(caster);
      if (!target) return;
      const line = dashLine(caster, target, P.dashLength);
      const struck = line.map((p) => api.occupant(p)).filter((f): f is SkillFighter => !!f && f.side !== caster.side);
      const phantom = (caster.skill.dashes ?? 0) >= P.phantomAfter;
      for (const enemy of struck) api.hit(caster, enemy, raw, 'physical', 'phantomexecution');
      // The Phantom retraces the same path right behind him.
      if (phantom) for (const enemy of struck) if (enemy.hp > 0) api.hit(caster, enemy, raw, 'physical', 'phantom');
      // Land on the farthest free cell of the line; stay put if there is none.
      const landing = [...line].reverse().find((p) => !api.occupant(p));
      if (landing) api.dashTo(caster, landing);
      caster.skill.dashes = (caster.skill.dashes ?? 0) + 1;
    }
  },
};
