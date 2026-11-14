import { pct } from '../traits/format';
import { enemiesOn, lineThrough } from './areas';
import type { SkillDef } from './types';

// Yang (4g Dragon Altar / Fighter). Per star, index 0 = 1★.
export const WYRM_FRENZY = {
  attackSpeed: 1.2, // while the enhanced attacks last
  attacks: 4, // enhanced attacks after the cast
  damage: [1.5, 1.5, 4.15], // of attack, physical: each enhanced attack, to its target and every enemy behind it
  heal: [0.3, 0.35, 0.85], // of attack, restored on each enhanced hit
};

const EFFECT = 'wyrmfrenzy';

export const wyrmFrenzy: SkillDef = {
  id: 'wyrmfrenzy',
  name: 'Wyrm Frenzy',
  desc:
    `Gains +${pct(WYRM_FRENZY.attackSpeed)} attack speed, and its next ${WYRM_FRENZY.attacks} attacks are enhanced: they pierce ` +
    'through their target, dealing {damage} of attack as physical damage to it and every enemy behind it, and each restores {heal} ' +
    "of attack as HP. Fighter's hit-again is enhanced too and doesn't use up an attack. The attack speed ends with the last one.",
  damage: { damage: 'physical' },
  values: () => ({ damage: WYRM_FRENZY.damage.map(pct), heal: WYRM_FRENZY.heal.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    // Recast mid-frenzy: read the attack without the old bonus (the buff refreshes, not stacks).
    const base = caster.stats.atk - (api.hasBuff(caster, EFFECT) ? (caster.skill.bonusAtk ?? 0) : 0);
    caster.skill.left = WYRM_FRENZY.attacks;
    caster.skill.baseAtk = base;
    // The enhanced attack is a basic attack with the extra attack on top, so items and crits still apply.
    caster.skill.bonusAtk = Math.round(base * (WYRM_FRENZY.damage[i] - 1));
    api.buff(
      caster,
      [
        { stat: 'attackSpeed', add: WYRM_FRENZY.attackSpeed },
        { stat: 'atk', add: caster.skill.bonusAtk },
      ],
      Infinity,
      EFFECT,
      caster,
    );
  },
  // Every enhanced hit (Fighter's hit-again included) heals and pierces on through the target.
  onBasicHit(api, caster, target) {
    if (!(caster.skill.left > 0)) return;
    const i = caster.star - 1;
    api.heal(caster, caster.skill.baseAtk * WYRM_FRENZY.heal[i]);
    if (target.x === caster.x && target.y === caster.y) return;
    const behind = lineThrough(caster, target);
    const past = behind.findIndex((c) => c.x === target.x && c.y === target.y);
    for (const e of enemiesOn(api, caster, behind.slice(past + 1))) {
      if (e.hp > 0) api.hit(caster, e, caster.skill.baseAtk * WYRM_FRENZY.damage[i], 'physical', EFFECT);
    }
  },
  // A whole attack (with its hit-again) uses up one; the frenzy ends with the last.
  afterAttack(api, caster) {
    if (!(caster.skill.left > 0)) return;
    if (--caster.skill.left > 0) return;
    caster.skill.bonusAtk = 0;
    api.unbuff(caster, EFFECT);
  },
};
