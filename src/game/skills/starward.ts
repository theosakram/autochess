import { MAX_COMBAT_TICKS, TICKS_PER_SECOND } from '../config';
import { pct } from '../traits/format';
import type { SkillDef, SkillFighter } from './types';

// Stardust Squire (1g Defender). Per star, index 0 = 1★.
export const STARWARD = {
  shield: [0.1, 0.15, 0.25], // passive: of its own and each flanking ally's max hp, for the whole fight
  heal: [0.12, 0.16, 0.28], // active: of each healed ally's own max hp
  healed: 2,
};

export const starward: SkillDef = {
  id: 'starward',
  name: 'Starward',
  desc:
    'Passive: when combat starts, it and the allies directly left and right of it gain a shield of {shield} of their max HP for the whole fight. ' +
    `Active: heals the ${STARWARD.healed} allies with the lowest HP (itself included) for {heal} of their max HP.`,
  values: () => ({ shield: STARWARD.shield.map(pct), heal: STARWARD.heal.map(pct) }),
  atStart(api, caster) {
    const share = STARWARD.shield[caster.star - 1];
    for (const ally of api.alliesOf(caster)) {
      if (ally.y === caster.y && Math.abs(ally.x - caster.x) <= 1) {
        api.shield(ally, ally.maxHp * share, MAX_COMBAT_TICKS / TICKS_PER_SECOND, `starward${caster.id}`);
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
    for (const a of hurt) api.heal(a, a.maxHp * share);
  },
};
