import { pct } from '../traits/format';
import { enemiesOn, facingStrip } from './areas';
import type { SkillApi, SkillFighter, SkillDef } from './types';

// Balang (5g Skybringer / Fighter): fists of thunder. Per star, index 0 = 1★.
// Every punch, counter and jab is a full attack: crits, items, Masterstroke and every other on-attack effect
// work as for a basic attack. None of them refill his mana.
export const STORM_FISTS = {
  // Passive, every star: a chance to counter whoever hurts him, at any range.
  counter: 0.25,
  counterPower: [0.85, 0.9, 8], // of attack
  // Active, 1★ and 2★: punches forward into a strip 3 tiles wide to the edge of the board, unstoppable.
  punches: 8,
  every: 0.12, // seconds between punches
  power: [0.5, 0.5, 2.25], // of attack per punch, to each enemy in the strip
  // 3★: a turret. Unstoppable from the start, never moves or basic-attacks; punches a random enemy on a timer.
  jabEvery: 0.3, // seconds
  jabPower: 1.15, // of attack
  // ...and when its mana is full, a burst of rapid punches at one random enemy.
  comboHits: 5,
  comboSeconds: 0.8, // from the first punch to the last
  comboPower: 1.4, // of attack per punch
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
    for (const e of enemiesOn(api, caster, strip)) if (e.hp > 0) api.attack(caster, e, STORM_FISTS.power[caster.star - 1], false);
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
    if (victim) api.attack(caster, victim, STORM_FISTS.comboPower, false);
  };
  hit();
  api.repeat(caster, STORM_FISTS.comboSeconds / (STORM_FISTS.comboHits - 1), STORM_FISTS.comboHits - 1, hit);
}

export const stormFists: SkillDef = {
  id: 'stormfists',
  name: 'Storm Fists',
  desc:
    `Punches forward ${STORM_FISTS.punches} times, ${STORM_FISTS.every}s apart, into a strip 3 tiles wide to the edge of the board: ` +
    `each punch hits every enemy in it for {power} of attack. It can't be stunned, taunted or moved while punching. ` +
    `Passive: when it takes damage, it has ${pct(STORM_FISTS.counter)} chance to counter once, at any range, for {counter} of attack. ` +
    `At 3★ it fights differently: from the start it can't be stunned, taunted or moved, never moves or basic-attacks, and punches ` +
    `a random enemy every ${STORM_FISTS.jabEvery}s for {jab} of attack. With full mana, it punches one random enemy ` +
    `${STORM_FISTS.comboHits} times over ${STORM_FISTS.comboSeconds}s for {combo} of attack each. ` +
    'Every punch and counter is a full attack: it triggers items and every on-attack effect.',
  damage: { power: 'physical', counter: 'physical', jab: 'physical', combo: 'physical' },
  values: () => ({
    power: STORM_FISTS.power.map(pct),
    counter: STORM_FISTS.counterPower.map(pct),
    jab: [pct(STORM_FISTS.jabPower)],
    combo: [pct(STORM_FISTS.comboPower)],
  }),
  atStart(api, caster) {
    if (caster.star < TURRET_STAR) return;
    api.ccImmune(caster, Infinity);
    api.stance(caster, { rooted: true, noBasic: true });
    api.repeat(caster, STORM_FISTS.jabEvery, Infinity, () => {
      if (!api.canAct(caster)) return;
      const e = randomEnemy(api, caster);
      if (e) api.attack(caster, e, STORM_FISTS.jabPower, false);
    });
  },
  onDamaged(api, caster, dealer) {
    if (api.random(1000) >= STORM_FISTS.counter * 1000) return;
    api.showProjectile(caster, dealer, 0.15, EFFECT);
    api.attack(caster, dealer, STORM_FISTS.counterPower[caster.star - 1], false);
  },
  cast(api, caster, target) {
    if (caster.star >= TURRET_STAR) combo(api, caster);
    else gatling(api, caster, target);
  },
};
