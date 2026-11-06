import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Skyreaver (4g Weapon Master). Per star, index 0 = 1★.
export const SKY_REAP = {
  normal: 2, // plain attacks before one that hits twice: hit, hit, hit-hit
  frenzied: 1, // while the active lasts: hit, hit-hit
  attackSpeed: [0.65, 1, 1.4], // active
  lifesteal: [0.4, 0.5, 0.8], // active
  seconds: 6,
};

export const skyReap: SkillDef = {
  id: 'skyreap',
  name: 'Sky Reap',
  desc:
    `Passive: every third attack strikes twice (hit, hit, hit-hit). ` +
    `Active: for ${SKY_REAP.seconds}s, gains +{as} attack speed and {lifesteal} lifesteal, and every second attack strikes twice (hit, hit-hit).`,
  values: () => ({ as: SKY_REAP.attackSpeed.map(pct), lifesteal: SKY_REAP.lifesteal.map(pct) }),
  onBasicHit(api, caster, target) {
    const plain = api.hasBuff(caster, 'skyreap') ? SKY_REAP.frenzied : SKY_REAP.normal;
    caster.skill.count = (caster.skill.count ?? 0) + 1;
    if (caster.skill.count <= plain) return;
    caster.skill.count = 0;
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const power = api.attackPower(caster);
    api.basicHit(caster, victim, power.amount, power.type, 'skyreap');
  },
  cast(api, caster) {
    const i = caster.star - 1;
    api.buff(
      caster,
      [
        { stat: 'attackSpeed', add: SKY_REAP.attackSpeed[i] },
        { stat: 'lifesteal', add: SKY_REAP.lifesteal[i] },
      ],
      SKY_REAP.seconds,
      'skyreap',
      caster,
    );
  },
};
