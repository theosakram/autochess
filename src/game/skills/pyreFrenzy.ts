import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Mia (2g Cult of Fire / Deadeye). Per star, index 0 = 1★.
export const PYRE_FRENZY = {
  aura: 0.2, // passive attack speed: itself and the allies directly left and right of it, for the fight
  frenzy: [0.5, 0.55, 0.65], // active: more attack speed for itself
  seconds: 5,
};

export const pyreFrenzy: SkillDef = {
  id: 'pyrefrenzy',
  name: 'Pyre Frenzy',
  desc:
    `Passive: at the start of combat, it and the allies directly left and right of it gain +${pct(PYRE_FRENZY.aura)} attack speed for the fight. ` +
    `Active: gains +{frenzy} attack speed for ${PYRE_FRENZY.seconds}s.`,
  values: () => ({ frenzy: PYRE_FRENZY.frenzy.map(pct) }),
  atStart(api, caster) {
    for (const ally of api.alliesOf(caster)) {
      if (ally.y === caster.y && Math.abs(ally.x - caster.x) <= 1) api.buff(ally, [{ stat: 'attackSpeed', add: PYRE_FRENZY.aura }], Infinity, 'pyreaura', caster);
    }
  },
  cast(api, caster) {
    api.buff(caster, [{ stat: 'attackSpeed', add: PYRE_FRENZY.frenzy[caster.star - 1] }], PYRE_FRENZY.seconds, 'pyrefrenzy', caster);
  },
};
