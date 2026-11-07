import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Yang (4g Dragon Altar / Fighter). Per star, index 0 = 1★.
export const WYRM_FRENZY = {
  attackSpeed: [1, 1.25, 1.5], // while the empowered attacks last
  attacks: [3, 4, 5], // empowered attacks after the cast
  bonus: [0.5, 0.5, 3.15], // of its attack, added to each empowered attack
  heal: [0.3, 0.35, 0.85], // of its attack, restored on each empowered hit
};

const EFFECT = 'wyrmfrenzy';

export const wyrmFrenzy: SkillDef = {
  id: 'wyrmfrenzy',
  name: 'Wyrm Frenzy',
  desc:
    'Gains +{as} attack speed, and its next {attacks} attacks are empowered: +{bonus} of its attack as extra damage, ' +
    "and each hit restores {heal} of its attack as HP. Fighter's hit-again is empowered too and doesn't use up an attack.",
  damage: { bonus: 'physical' },
  values: () => ({
    as: WYRM_FRENZY.attackSpeed.map(pct),
    attacks: WYRM_FRENZY.attacks.map(String),
    bonus: WYRM_FRENZY.bonus.map(pct),
    heal: WYRM_FRENZY.heal.map(pct),
  }),
  cast(api, caster) {
    const i = caster.star - 1;
    // Recast mid-frenzy: read the attack without the old bonus (the buff refreshes, not stacks).
    const base = caster.stats.atk - (api.hasBuff(caster, EFFECT) ? (caster.skill.bonusAtk ?? 0) : 0);
    caster.skill.left = WYRM_FRENZY.attacks[i];
    caster.skill.baseAtk = base;
    caster.skill.bonusAtk = Math.round(base * WYRM_FRENZY.bonus[i]);
    api.buff(
      caster,
      [
        { stat: 'attackSpeed', add: WYRM_FRENZY.attackSpeed[i] },
        { stat: 'atk', add: caster.skill.bonusAtk },
      ],
      Infinity,
      EFFECT,
      caster,
    );
  },
  // Every empowered hit heals, Fighter's hit-again included.
  onBasicHit(api, caster) {
    if (!(caster.skill.left > 0)) return;
    api.heal(caster, caster.skill.baseAtk * WYRM_FRENZY.heal[caster.star - 1]);
  },
  // A whole attack (with its hit-again) uses up one; the frenzy ends with the last.
  afterAttack(api, caster) {
    if (!(caster.skill.left > 0)) return;
    if (--caster.skill.left > 0) return;
    caster.skill.bonusAtk = 0;
    api.unbuff(caster, EFFECT);
  },
};
