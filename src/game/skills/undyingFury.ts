import { pct } from '../traits/format';
import { around, enemiesOn, middleCell } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillDef } from './types';

// Thamar (5g Necromancer / Weapon Master): a necromantic berserk. Per star, index 0 = 1★.
export const UNDYING_FURY = {
  // Passive: after every `plainAttacks` attacks, the next one deals extra damage.
  plainAttacks: 3,
  empowered: [0.65, 0.75, 15], // of attack, physical, added to that attack
  // Active: leaps onto the spot with the most enemies around it (at 3 stars, the middle of the board).
  slam: [0.5, 0.5, 16.5], // of attack, physical, to each enemy around where it lands (at 3 stars, every enemy)
  seconds: 4, // then rages this long
  attackSpeed: [1.1, 1.1, 2],
  every: 0.5,
  aura: [0.55, 0.6, 2.35], // of attack, physical, per tick to each enemy around it
  centerStar: 3,
};

export const undyingFury: SkillDef = {
  id: 'undyingfury',
  name: 'Undying Fury',
  desc:
    `Passive: every ${UNDYING_FURY.plainAttacks + 1}th attack deals {empowered} of attack more. ` +
    'Active: leaps onto the spot with the most enemies around it and slams: every enemy around it takes {slam} of attack as physical damage. ' +
    `Then it rages for ${UNDYING_FURY.seconds}s: +{as} attack speed, and every ${UNDYING_FURY.every}s each enemy around it ` +
    `takes {aura} of attack as physical damage. At ${UNDYING_FURY.centerStar}★ it leaps to the middle of the board instead, ` +
    'and the slam hits every enemy on the board.',
  damage: { empowered: 'physical', slam: 'physical', aura: 'physical' },
  values: () => ({
    empowered: UNDYING_FURY.empowered.map(pct),
    slam: UNDYING_FURY.slam.map(pct),
    as: UNDYING_FURY.attackSpeed.map(pct),
    aura: UNDYING_FURY.aura.map(pct),
  }),
  // The empowered attack: extra damage on each of its hits (a Fighter hit-again included).
  onBasicHit(api, caster, target) {
    if (!caster.skill.empowered || target.hp <= 0) return;
    api.basicHit(caster, target, caster.stats.atk * UNDYING_FURY.empowered[caster.star - 1], 'physical', 'undyingfuryhit');
  },
  // Counts whole attacks: three plain ones, then an empowered one.
  afterAttack(_api, caster) {
    if (caster.skill.empowered) {
      caster.skill.empowered = 0;
      caster.skill.count = 0;
      return;
    }
    caster.skill.count = (caster.skill.count ?? 0) + 1;
    if (caster.skill.count >= UNDYING_FURY.plainAttacks) caster.skill.empowered = 1;
  },
  cast(api, caster) {
    const U = UNDYING_FURY;
    const i = caster.star - 1;
    const center = caster.star >= U.centerStar;
    const spot = center ? middleCell(api, caster) : densestDrop(api, caster);
    if (spot && (spot.x !== caster.x || spot.y !== caster.y)) api.dashTo(caster, spot);
    const slam = caster.stats.atk * U.slam[i];
    for (const e of center ? api.enemiesOf(caster) : enemiesOn(api, caster, around(caster))) api.hit(caster, e, slam, 'physical', 'undyingfury');
    api.buff(caster, [{ stat: 'attackSpeed', add: U.attackSpeed[i] }], U.seconds, 'undyingfury', caster);
    const tick = () => {
      const raw = caster.stats.atk * U.aura[i];
      for (const e of enemiesOn(api, caster, around(caster))) if (e.hp > 0) api.hit(caster, e, raw, 'physical', 'undyingfuryaura');
    };
    api.repeat(caster, U.every, Math.round(U.seconds / U.every), tick);
  },
};
