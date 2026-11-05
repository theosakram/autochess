import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Pyre Guard (2g Deadeye). Per star, index 0 = 1★.
export const PYRE_FRENZY = {
  aura: [0.15, 0.2, 0.35], // passive attack speed: itself and allies directly beside it, for the fight
  frenzy: [0.6, 0.8, 1.5], // active: more attack speed for itself
  seconds: 5,
};

export const pyreFrenzy: SkillDef = {
  id: 'pyrefrenzy',
  name: 'Pyre Frenzy',
  desc:
    'Passive: at the start of combat, it and allies directly beside it (left, right, front, back) gain +{aura} attack speed for the fight. ' +
    `Active: gains +{frenzy} attack speed for ${PYRE_FRENZY.seconds}s.`,
  values: () => ({ aura: PYRE_FRENZY.aura.map(pct), frenzy: PYRE_FRENZY.frenzy.map(pct) }),
  atStart(api, caster) {
    const add = PYRE_FRENZY.aura[caster.star - 1];
    for (const ally of api.alliesOf(caster)) {
      if (Math.abs(ally.x - caster.x) + Math.abs(ally.y - caster.y) <= 1) api.buff(ally, [{ stat: 'attackSpeed', add }], Infinity, 'pyreaura', caster);
    }
  },
  cast(api, caster) {
    api.buff(caster, [{ stat: 'attackSpeed', add: PYRE_FRENZY.frenzy[caster.star - 1] }], PYRE_FRENZY.seconds, 'pyrefrenzy', caster);
  },
};
