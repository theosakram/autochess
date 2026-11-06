import { pct } from '../traits/format';
import { enemiesOn, row3 } from './areas';
import type { SkillDef } from './types';

// Bone Adept (1g Mage). Per star, index 0 = 1★.
export const GRAVE_WHISPER = {
  mana: [20, 30, 50], // passive: to itself and each ally directly beside it when the fight starts
  ap: [1.1, 1.3, 2.4], // active: of magic attack, magic, to the 3x1 row around its target
};

export const graveWhisper: SkillDef = {
  id: 'gravewhisper',
  name: 'Grave Whisper',
  desc:
    'Passive: when combat starts, it and every ally directly beside it (left, right, front, back) gain {mana} mana. ' +
    'Active: whispers death into the 3x1 row around its target for {ap} of magic attack as magic damage.',
  values: () => ({ mana: GRAVE_WHISPER.mana.map(String), ap: GRAVE_WHISPER.ap.map(pct) }),
  atStart(api, caster) {
    for (const ally of api.alliesOf(caster)) {
      if (Math.abs(ally.x - caster.x) + Math.abs(ally.y - caster.y) <= 1) api.giveMana(ally, GRAVE_WHISPER.mana[caster.star - 1]);
    }
  },
  cast(api, caster, target) {
    const center = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!center) return;
    const raw = caster.stats.ap * GRAVE_WHISPER.ap[caster.star - 1];
    for (const e of enemiesOn(api, caster, row3(center))) api.hit(caster, e, raw, 'magic', 'gravewhisper');
  },
};
