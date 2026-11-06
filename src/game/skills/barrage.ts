import type { DamageType } from '../stats';
import { pct } from '../traits/format';
import type { SkillDef, SkillFighter } from './types';

// Per star, index 0 = 1★.
export interface Barrage {
  id: string;
  name: string;
  hits: number;
  every: number; // seconds between hits (the first lands on cast)
  scale: number[]; // of `stat`, per hit
  stat: 'atk' | 'ap';
  type: DamageType;
  busy: boolean; // true: it does nothing else until the last hit
  projectile: boolean; // draw each hit as a projectile flying from it
}

// The same skill hit on its target `hits` times, `every` seconds apart. Skill hits: they can't crit.
// If the target falls, the rest go to the nearest enemy.
export function barrage(cfg: Barrage): SkillDef {
  const statName = cfg.stat === 'ap' ? 'magic attack' : 'attack';
  return {
    id: cfg.id,
    name: cfg.name,
    desc: `Hits its target ${cfg.hits} times, ${cfg.every}s apart, each for {scale} of ${statName} as ${cfg.type} damage. These can't crit.`,
    values: () => ({ scale: cfg.scale.map(pct) }),
    cast(api, caster, target) {
      let victim: SkillFighter | null = target;
      let n = 0;
      const raw = caster.stats[cfg.stat] * cfg.scale[caster.star - 1];
      const hit = () => {
        if (!victim || victim.hp <= 0) victim = api.nearestEnemy(caster);
        if (victim) {
          if (cfg.projectile) api.showProjectile(caster, victim, Math.min(cfg.every, 0.3), cfg.id);
          api.hit(caster, victim, raw, cfg.type, cfg.id);
        }
        if (++n >= cfg.hits || !victim) {
          if (cfg.busy) api.busy(caster, false);
          return false;
        }
        return true;
      };
      if (cfg.busy) api.busy(caster, true);
      if (hit()) api.repeat(caster, cfg.every, cfg.hits - 1, hit);
    },
  };
}
