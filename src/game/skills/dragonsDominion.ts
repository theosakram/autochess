import { MAX_COMBAT_TICKS, TICKS_PER_SECOND } from '../config';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillDef } from './types';

// Ancient Dragon (5g Defender). Per star, index 0 = 1★.
export const DRAGONS_DOMINION = {
  wingShield: [0.15, 0.2, 0.4], // passive: of the Dragon's max hp, to each ally directly left and right, for the fight
  hp: [0.12, 0.15, 0.3], // active: of its max hp, physical, to each enemy around where it lands
  taunt: 3, // seconds
  shield: [0.25, 0.3, 0.5], // of its max hp
  seconds: 4,
};

export const dragonsDominion: SkillDef = {
  id: 'dragonsdominion',
  name: "Dragon's Dominion",
  desc:
    'Passive: when combat starts, the allies directly left and right of it gain a shield of {wing} of its max HP for the whole fight. ' +
    'Active: lands among the enemy (the spot with the most of them around it): every enemy around it takes {hp} of its max HP ' +
    `as physical damage and is taunted for ${DRAGONS_DOMINION.taunt}s, and it gains a shield of {shield} of its max HP for ${DRAGONS_DOMINION.seconds}s.`,
  values: () => ({ wing: DRAGONS_DOMINION.wingShield.map(pct), hp: DRAGONS_DOMINION.hp.map(pct), shield: DRAGONS_DOMINION.shield.map(pct) }),
  atStart(api, caster) {
    const amount = caster.maxHp * DRAGONS_DOMINION.wingShield[caster.star - 1];
    for (const ally of api.alliesOf(caster)) {
      if (ally.y === caster.y && Math.abs(ally.x - caster.x) === 1) api.shield(ally, amount, MAX_COMBAT_TICKS / TICKS_PER_SECOND, `wings${caster.id}`);
    }
  },
  cast(api, caster) {
    const D = DRAGONS_DOMINION;
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    for (const e of enemiesOn(api, caster, around(caster))) {
      if (!api.hit(caster, e, caster.maxHp * D.hp[i], 'physical', 'dragonsdominion')) api.taunt(e, caster, D.taunt);
    }
    api.shield(caster, caster.maxHp * D.shield[i], D.seconds, 'dragonsdominion');
  },
};
