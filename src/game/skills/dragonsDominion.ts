import { MAX_COMBAT_TICKS, TICKS_PER_SECOND } from '../config';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Balia (5g Dragon Altar / Defender). Per star, index 0 = 1★.
export const DRAGONS_DOMINION = {
  lava: [0.1, 0.1, 0.12], // passive: Lava Shield, of Balia's max hp, on itself and the allies directly left and right
  explode: [1.3, 1.45, 4.8], // of Balia's magic attack, magic, to each enemy around the holder when a Lava Shield breaks
  ap: [0.9, 1, 12.65], // active: of its magic attack...
  hp: [0.1, 0.1, 0.15], // ...plus this share of its max hp, as magic damage to each enemy around where it lands
  taunt: 3, // seconds
};

const FIGHT = MAX_COMBAT_TICKS / TICKS_PER_SECOND;

// A Lava Shield that explodes when it breaks, then comes back (while Balia lives).
function lavaShield(api: SkillApi, caster: SkillFighter, holder: SkillFighter): void {
  const i = caster.star - 1;
  api.shield(holder, caster.maxHp * DRAGONS_DOMINION.lava[i], FIGHT, `lava${caster.id}`, () => {
    if (caster.hp <= 0) return;
    // An explosion can't set off another one in the same chain (e.g. through damage reflected back).
    if (!caster.skill.exploding) {
      caster.skill.exploding = 1;
      for (const e of enemiesOn(api, holder, around(holder))) api.hit(caster, e, caster.stats.ap * DRAGONS_DOMINION.explode[i], 'magic', 'lavashield');
      caster.skill.exploding = 0;
    }
    lavaShield(api, caster, holder);
  });
}

export const dragonsDominion: SkillDef = {
  id: 'dragonsdominion',
  name: "Dragon's Dominion",
  desc:
    'Passive: when combat starts, it and the allies directly left and right of it gain a Lava Shield of {lava} of its max HP. ' +
    "When a Lava Shield breaks, it explodes for {explode} of this unit's magic attack as magic damage to every enemy around its holder, " +
    'then comes back (while this unit lives). ' +
    'Active: lands among the enemy (the spot with the most of them around it): every enemy around it takes {ap} of its magic attack ' +
    `plus {hp} of its max HP as magic damage and is taunted for ${DRAGONS_DOMINION.taunt}s.`,
  damage: { explode: 'magic', ap: 'magic', hp: 'magic' },
  values: () => ({
    lava: DRAGONS_DOMINION.lava.map(pct),
    explode: DRAGONS_DOMINION.explode.map(pct),
    ap: DRAGONS_DOMINION.ap.map(pct),
    hp: DRAGONS_DOMINION.hp.map(pct),
  }),
  atStart(api, caster) {
    for (const ally of api.alliesOf(caster)) {
      if (ally.y === caster.y && Math.abs(ally.x - caster.x) <= 1) lavaShield(api, caster, ally);
    }
  },
  cast(api, caster) {
    const D = DRAGONS_DOMINION;
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (spot) api.dashTo(caster, spot);
    const raw = caster.stats.ap * D.ap[i] + caster.maxHp * D.hp[i];
    for (const e of enemiesOn(api, caster, around(caster))) {
      if (!api.hit(caster, e, raw, 'magic', 'dragonsdominion')) api.taunt(e, caster, D.taunt);
    }
  },
};
