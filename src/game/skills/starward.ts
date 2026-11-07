import { MAX_COMBAT_TICKS, TICKS_PER_SECOND } from '../config';
import { pct } from '../traits/format';
import type { SkillDef, SkillFighter } from './types';

// Minos (1g Astral / Defender). Per star, index 0 = 1★.
export const STARWARD = {
  shield: [400, 700, 2000], // passive: flat, on itself and each flanking ally, for the whole fight
  heal: [0.2, 0.25, 0.3], // active: of each healed ally's own max hp
  healed: 2,
};

export const starward: SkillDef = {
  id: 'starward',
  name: 'Starward',
  desc:
    'Passive: when combat starts, it and the allies directly left and right of it gain a {shield} shield for the whole fight. ' +
    `Active: heals the ${STARWARD.healed} allies with the lowest HP (itself included) for {heal} of their max HP.`,
  values: () => ({ shield: STARWARD.shield.map(String), heal: STARWARD.heal.map(pct) }),
  atStart(api, caster) {
    const amount = STARWARD.shield[caster.star - 1];
    for (const ally of api.alliesOf(caster)) {
      if (ally.y === caster.y && Math.abs(ally.x - caster.x) <= 1) {
        api.shield(ally, amount, MAX_COMBAT_TICKS / TICKS_PER_SECOND, `starward${caster.id}`);
      }
    }
  },
  cast(api, caster) {
    const share = STARWARD.heal[caster.star - 1];
    const hurt = api
      .alliesOf(caster)
      .filter((a) => a.hp < a.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)
      .slice(0, STARWARD.healed) as SkillFighter[];
    for (const a of hurt) api.heal(a, a.maxHp * share, caster);
  },
};
