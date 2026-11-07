import { GRID_H, GRID_W, type Point } from '../grid';
import { pct } from '../traits/format';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Lance (5g Gustiwana / Phasewarper). Per star, index 0 = 1★.
export const PHANTOM_EXECUTION = {
  atk: [1.4, 1.6, 4.5], // of total physical attack, to every enemy along a dash (and again from a Phantom)
  maxDashes: 3, // the 1st cast dashes once, each later cast once more, up to this
  dashLength: 4, // cells
  dashSeconds: 0.2, // how long one dash takes, for the damage reduction
  dashReduction: 0.15, // less damage taken while dashing
  phantomAfter: 3, // dashes in this fight before every dash leaves a Phantom
  openingDashes: 3, // 3★ only: dashes this many times as the fight starts
};

// `n` dashes in a row, each through the nearest enemy, guarded while they last.
function dashes(api: SkillApi, caster: SkillFighter, n: number): void {
  const P = PHANTOM_EXECUTION;
  api.guard(caster, n * P.dashSeconds, P.dashReduction);
  const raw = caster.stats.atk * P.atk[caster.star - 1];
  for (let i = 0; i < n; i++) {
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
}

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
    `Passive: after ${PHANTOM_EXECUTION.phantomAfter} dashes, every dash leaves a Phantom that deals the same damage along its path. ` +
    `3★: dashes ${PHANTOM_EXECUTION.openingDashes} times as the fight starts.`,
  damage: { atk: 'physical' },
  values: () => ({ atk: PHANTOM_EXECUTION.atk.map(pct) }),
  // The opening dashes count toward the Phantom passive, not toward the cast count.
  atStart(api, caster) {
    if (caster.star >= 3) dashes(api, caster, PHANTOM_EXECUTION.openingDashes);
  },
  cast(api, caster) {
    caster.skill.casts = (caster.skill.casts ?? 0) + 1;
    dashes(api, caster, Math.min(caster.skill.casts, PHANTOM_EXECUTION.maxDashes));
  },
};
