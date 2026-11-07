import { pct } from '../traits/format';
import { enemiesOn, facingStrip } from './areas';
import type { SkillApi, SkillFighter, SkillDef } from './types';

// Balang (5g Skybringer / Fighter): fists of thunder. Per star, index 0 = 1★.
export const STORM_FISTS = {
  // Passive, every star.
  counter: 0.25, // chance to strike back at whoever basic-attacks it, at any range
  counterPower: 0.85, // of its attack, physical (an enhanced basic hit)
  atk: [0.5, 0.5, 2.25], // more attack, all fight
  damageAmp: [0.85, 0.9, 8], // more damage, all fight
  // Active, 1★ and 2★: a channeled gatling, immune to crowd control.
  punches: 8,
  every: 0.12, // seconds between punches
  power: 0.25, // of its attack per punch, to each enemy in the strip (an enhanced basic hit)
  // 3★: a turret. It stays put and never basic-attacks; it jabs a random enemy on a timer instead.
  jabEvery: 0.25, // seconds
  jabPower: 1.15, // of its attack, physical (an enhanced basic hit)
  // ...and when its mana is full, a combo of full attacks (every item on-hit effect works) on one random enemy.
  comboHits: 5,
  comboSeconds: 0.8, // from the first hit to the last
  comboPower: 1.4, // of its attack per hit
};

const EFFECT = 'stormfists';
const TURRET_STAR = 3;

function randomEnemy(api: SkillApi, f: SkillFighter): SkillFighter | null {
  const all = api.enemiesOf(f);
  return all.length ? all[api.random(all.length)] : null;
}

function gatling(api: SkillApi, caster: SkillFighter, target: SkillFighter): void {
  let n = 0;
  // It faces its target (or the nearest enemy) and keeps punching that way for the whole channel.
  const facing = target.hp > 0 ? target : (api.nearestEnemy(caster) ?? target);
  const strip = facingStrip(caster, facing);
  const punch = () => {
    const raw = caster.stats.atk * STORM_FISTS.power;
    for (const e of enemiesOn(api, caster, strip)) if (e.hp > 0) api.basicHit(caster, e, raw, 'physical', EFFECT);
    if (++n >= STORM_FISTS.punches) api.busy(caster, false);
  };
  // Unstoppable for the whole channel (a tick of slack past the last punch).
  api.ccImmune(caster, (STORM_FISTS.punches - 1) * STORM_FISTS.every + 0.1);
  api.busy(caster, true);
  punch();
  api.repeat(caster, STORM_FISTS.every, STORM_FISTS.punches - 1, punch);
}

function combo(api: SkillApi, caster: SkillFighter): void {
  let victim = randomEnemy(api, caster);
  const hit = () => {
    if (!api.canAct(caster)) return;
    if (!victim || victim.hp <= 0) victim = randomEnemy(api, caster);
    if (victim) api.attack(caster, victim, STORM_FISTS.comboPower);
  };
  hit();
  api.repeat(caster, STORM_FISTS.comboSeconds / (STORM_FISTS.comboHits - 1), STORM_FISTS.comboHits - 1, hit);
}

export const stormFists: SkillDef = {
  id: 'stormfists',
  name: 'Storm Fists',
  desc:
    `Passive: has +{atk} attack and +{amp} damage. When an enemy's basic attack hits it, it has ${pct(STORM_FISTS.counter)} chance ` +
    `to strike back at once, at any range, for {counter} of attack. ` +
    `Active: channels ${STORM_FISTS.punches} thunder punches, ${STORM_FISTS.every}s apart, into a strip 3 tiles wide toward its target, ` +
    `to the edge of the board: each hits every enemy in it for {power} of attack. It can't be stunned, taunted or moved while channeling. ` +
    `At 3★ it fights differently: it never moves or basic-attacks, and punches a random enemy every ${STORM_FISTS.jabEvery}s ` +
    `for {jab} of attack. With full mana, it punches one random enemy ${STORM_FISTS.comboHits} times over ` +
    `${STORM_FISTS.comboSeconds}s for {combo} of attack each, as full attacks that trigger every item effect.`,
  damage: { counter: 'physical', power: 'physical', jab: 'physical', combo: 'physical' },
  values: () => ({
    atk: STORM_FISTS.atk.map(pct),
    amp: STORM_FISTS.damageAmp.map(pct),
    counter: [pct(STORM_FISTS.counterPower)],
    power: [pct(STORM_FISTS.power)],
    jab: [pct(STORM_FISTS.jabPower)],
    combo: [pct(STORM_FISTS.comboPower)],
  }),
  atStart(api, caster) {
    const i = caster.star - 1;
    api.buff(
      caster,
      [
        { stat: 'atk', add: Math.round(caster.stats.atk * STORM_FISTS.atk[i]) },
        { stat: 'damageAmp', add: STORM_FISTS.damageAmp[i] },
      ],
      Infinity,
      EFFECT,
      caster,
    );
    if (caster.star < TURRET_STAR) return;
    api.stance(caster, { rooted: true, noBasic: true });
    api.repeat(caster, STORM_FISTS.jabEvery, Infinity, () => {
      if (!api.canAct(caster)) return;
      const e = randomEnemy(api, caster);
      if (e) api.basicHit(caster, e, caster.stats.atk * STORM_FISTS.jabPower, 'physical', EFFECT);
    });
  },
  onAttacked(api, caster, attacker) {
    if (api.random(1000) >= STORM_FISTS.counter * 1000) return;
    api.showProjectile(caster, attacker, 0.15, EFFECT);
    api.basicHit(caster, attacker, caster.stats.atk * STORM_FISTS.counterPower, 'physical', EFFECT);
  },
  cast(api, caster, target) {
    if (caster.star >= TURRET_STAR) combo(api, caster);
    else gatling(api, caster, target);
  },
};
