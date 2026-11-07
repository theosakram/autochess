import { pct } from '../traits/format';
import { enemiesOn, row3 } from './areas';
import type { SkillDef } from './types';

// Val (1g Necromancer / Mage). Per star, index 0 = 1★.
export const GRAVE_WHISPER = {
  mana: [10, 15, 20], // passive: to itself and the allies directly left and right of it when the fight starts
  ap: [1.55, 1.55, 2.05], // active: of magic attack, magic, to the 3x1 row around its target
};

export const graveWhisper: SkillDef = {
  id: 'gravewhisper',
  name: 'Grave Whisper',
  desc:
    'Passive: when combat starts, it and the allies directly left and right of it gain {mana} mana. ' +
    'Active: whispers death into the 3x1 row around its target for {ap} of magic attack as magic damage.',
  damage: { ap: 'magic' },
  values: () => ({ mana: GRAVE_WHISPER.mana.map(String), ap: GRAVE_WHISPER.ap.map(pct) }),
  atStart(api, caster) {
    for (const ally of api.alliesOf(caster)) {
      if (ally.y === caster.y && Math.abs(ally.x - caster.x) <= 1) api.giveMana(ally, GRAVE_WHISPER.mana[caster.star - 1]);
    }
  },
  cast(api, caster, target) {
    const center = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!center) return;
    const raw = caster.stats.ap * GRAVE_WHISPER.ap[caster.star - 1];
    for (const e of enemiesOn(api, caster, row3(center))) api.hit(caster, e, raw, 'magic', 'gravewhisper');
  },
};
