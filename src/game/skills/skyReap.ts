import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Zhizong (4g Skybringer / Weapon Master). Per star, index 0 = 1★.
export const SKY_REAP = {
  // Passive: after `plain` plain attacks, the next one is empowered.
  plain: 3,
  frenzied: 2, // while the active lasts
  empowered: [0.8, 0.8, 2.4], // of attack, physical, added to that attack
  heal: [0.4, 0.4, 1.45], // of attack, healed on that attack
  attackSpeed: 0.6, // active
  seconds: 6, // active
};

const EFFECT = 'skyreap';

export const skyReap: SkillDef = {
  id: 'skyreap',
  name: 'Sky Reap',
  desc:
    `Passive: every ${SKY_REAP.plain + 1}th attack is empowered: it deals {empowered} of attack more and heals it for {heal} of its attack. ` +
    `Active: for ${SKY_REAP.seconds}s, gains +${pct(SKY_REAP.attackSpeed)} attack speed, and every ${SKY_REAP.frenzied + 1}rd attack is empowered.`,
  damage: { empowered: 'physical' },
  values: () => ({ empowered: SKY_REAP.empowered.map(pct), heal: SKY_REAP.heal.map(pct) }),
  // The empowered attack: extra damage and a heal on each of its hits (a Fighter hit-again included).
  onBasicHit(api, caster, target) {
    if (!caster.skill.empowered) return;
    const i = caster.star - 1;
    if (target.hp > 0) api.basicHit(caster, target, caster.stats.atk * SKY_REAP.empowered[i], 'physical', EFFECT);
    api.heal(caster, caster.stats.atk * SKY_REAP.heal[i]);
  },
  // Counts whole attacks: `plain` plain ones (fewer while the active lasts), then an empowered one.
  afterAttack(api, caster) {
    if (caster.skill.empowered) {
      caster.skill.empowered = 0;
      caster.skill.count = 0;
      return;
    }
    caster.skill.count = (caster.skill.count ?? 0) + 1;
    const plain = api.hasBuff(caster, EFFECT) ? SKY_REAP.frenzied : SKY_REAP.plain;
    if (caster.skill.count >= plain) caster.skill.empowered = 1;
  },
  cast(api, caster) {
    api.buff(caster, [{ stat: 'attackSpeed', add: SKY_REAP.attackSpeed }], SKY_REAP.seconds, EFFECT, caster);
    // Already two plain attacks in: the next one is empowered right away.
    if ((caster.skill.count ?? 0) >= SKY_REAP.frenzied) caster.skill.empowered = 1;
  },
};
