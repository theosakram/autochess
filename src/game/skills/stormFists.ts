import { pct } from '../traits/format';
import { enemiesOn, facingStrip } from './areas';
import type { SkillDef } from './types';

// Thunder Lord (5g Fighter): fists of thunder. Per star, index 0 = 1★.
export const STORM_FISTS = {
  counter: [0.4, 0.5, 0.7], // passive: chance to strike back at whoever basic-attacks it, at any range
  punches: 12,
  every: 0.12, // seconds between punches
  power: [0.33, 0.42, 1.75], // of its attack per punch, to each enemy in the strip (an enhanced basic hit)
};

export const stormFists: SkillDef = {
  id: 'stormfists',
  name: 'Storm Fists',
  desc:
    "Passive: when an enemy's basic attack hits it, it has {counter} chance to strike back at once with a fist of thunder " +
    '(a basic attack, at any range). ' +
    `Active: channels a gatling of ${STORM_FISTS.punches} thunder punches, ${STORM_FISTS.every}s apart, into a strip 3 tiles wide ` +
    'toward its target, to the edge of the board: each hits every enemy in it for {power} of attack. Punches can crit but not hit again.',
  values: () => ({ counter: STORM_FISTS.counter.map(pct), power: STORM_FISTS.power.map(pct) }),
  onAttacked(api, caster, attacker) {
    if (api.random(1000) >= STORM_FISTS.counter[caster.star - 1] * 1000) return;
    api.showProjectile(caster, attacker, 0.15, 'stormfists');
    api.counterAttack(caster, attacker);
  },
  cast(api, caster, target) {
    let n = 0;
    // It faces its target (or the nearest enemy) and keeps punching that way for the whole channel.
    const facing = target.hp > 0 ? target : (api.nearestEnemy(caster) ?? target);
    const strip = facingStrip(caster, facing);
    const punch = () => {
      const power = api.attackPower(caster);
      const raw = power.amount * STORM_FISTS.power[caster.star - 1];
      for (const e of enemiesOn(api, caster, strip)) if (e.hp > 0) api.basicHit(caster, e, raw, power.type, 'stormfists');
      if (++n >= STORM_FISTS.punches) api.busy(caster, false);
    };
    api.busy(caster, true);
    punch();
    api.repeat(caster, STORM_FISTS.every, STORM_FISTS.punches - 1, punch);
  },
};
