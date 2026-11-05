import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Per star, index 0 = 1★.
export interface EmpoweredAttack {
  id: string;
  name: string;
  bonus: number[]; // extra damage on top of a normal basic attack
  // Optionally tears the target's armor and magic resist afterwards.
  tear?: { defense: number[]; seconds: number };
}

// The simplest skill: the unit's next attack hits harder (an enhanced basic attack: it can crit,
// applies shred and lifesteals), optionally lowering the target's defenses after.
export function empoweredAttack(cfg: EmpoweredAttack): SkillDef {
  const tear = cfg.tear;
  return {
    id: cfg.id,
    name: cfg.name,
    desc:
      'Empowers its next attack to deal {bonus} more damage' +
      (tear ? `, then tears the target's defenses: -{defense} armor and magic resist for ${tear.seconds}s.` : '.'),
    values: () => ({ bonus: cfg.bonus.map(pct), ...(tear && { defense: tear.defense.map(String) }) }),
    cast(api, caster, target) {
      const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
      if (!victim) return;
      const i = caster.star - 1;
      const power = api.attackPower(caster);
      api.basicHit(caster, victim, power.amount * (1 + cfg.bonus[i]), power.type, cfg.id);
      if (tear && victim.hp > 0) api.debuff(victim, { armor: tear.defense[i], mr: tear.defense[i] }, tear.seconds, cfg.id);
    },
  };
}
