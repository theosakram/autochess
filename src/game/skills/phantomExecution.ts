import { pct } from '../traits/format';
import { bestLine } from './areas';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Lance (5g Gustiwana / Phasewarper). Per star, index 0 = 1★.
export const PHANTOM_EXECUTION = {
  atk: [1.4, 1.6, 4.5], // of total physical attack, to every enemy along a dash (and again from a Phantom)
  dashesPerCast: 3,
  dashLength: 4, // cells
  dashSeconds: 0.3, // between dashes (whole ticks), and how long each is guarded
  dashAnim: 0.2, // how long each dash animates
  dashReduction: 0.15, // less damage taken while dashing
  phantomAfter: 3, // dashes in this fight before every dash leaves a Phantom
};

// One dash along the line through the most enemies. False when there's no one left to dash at.
function dash(api: SkillApi, caster: SkillFighter): boolean {
  const P = PHANTOM_EXECUTION;
  const line = bestLine(api, caster, P.dashLength);
  if (!line.length) return false;
  const raw = caster.stats.atk * P.atk[caster.star - 1];
  const struck = line.map((p) => api.occupant(p)).filter((f): f is SkillFighter => !!f && f.side !== caster.side);
  const phantom = (caster.skill.dashes ?? 0) >= P.phantomAfter;
  for (const enemy of struck) api.hit(caster, enemy, raw, 'physical', 'phantomexecution');
  // The Phantom retraces the same path right behind him.
  if (phantom) for (const enemy of struck) if (enemy.hp > 0) api.hit(caster, enemy, raw, 'physical', 'phantom');
  // Land on the farthest free cell of the line; stay put if there is none. With a Phantom, the dash looks it.
  const landing = [...line].reverse().find((p) => !api.occupant(p));
  if (landing) api.dashTo(caster, landing, P.dashAnim, phantom ? 'phantom' : 'phantomexecution');
  caster.skill.dashes = (caster.skill.dashes ?? 0) + 1;
  return true;
}

export const phantomExecution: SkillDef = {
  id: 'phantomexecution',
  name: 'Phantom Execution',
  desc:
    `Dashes ${PHANTOM_EXECUTION.dashesPerCast} times, each along the line through the most enemies, dealing {atk} of attack as physical damage to every enemy along the path. ` +
    `Takes ${pct(PHANTOM_EXECUTION.dashReduction)} less damage while dashing. ` +
    `Passive: after ${PHANTOM_EXECUTION.phantomAfter} dashes, every dash leaves a Phantom that deals the same damage along its path. ` +
    `3★: starts the fight with full mana.`,
  damage: { atk: 'physical' },
  values: () => ({ atk: PHANTOM_EXECUTION.atk.map(pct) }),
  atStart(api, caster) {
    if (caster.star >= 3) api.giveMana(caster, caster.stats.maxMana);
  },
  // One dash now, the rest `dashSeconds` apart; busy (no attacks, no mana) and guarded until the last.
  cast(api, caster) {
    const P = PHANTOM_EXECUTION;
    api.guard(caster, P.dashesPerCast * P.dashSeconds, P.dashReduction);
    api.busy(caster, true);
    let left = P.dashesPerCast;
    const next = () => {
      if (left <= 0) return;
      left = dash(api, caster) ? left - 1 : 0;
      if (left === 0) api.busy(caster, false);
    };
    next();
    api.repeat(caster, P.dashSeconds, P.dashesPerCast - 1, next);
  },
};
