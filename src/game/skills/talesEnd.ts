import { pct } from '../traits/format';
import { enemiesOn, within } from './areas';
import type { SkillDef } from './types';

// Taleshield (4g Storyweaver): a defender that hits like a truck. Per star, index 0 = 1★.
export const TALES_END = {
  atk: [3, 3.6, 8], // of attack...
  hp: [0.15, 0.15, 0.25], // ...plus this share of its max hp, physical, to every enemy around it
  radius: 1,
  // As the Storyweaver protagonist:
  protagonistRadius: 2,
  stun: 1.5, // seconds
  shield: 0.3, // of its max hp
  shieldSeconds: 4,
};

export const talesEnd: SkillDef = {
  id: 'talesend',
  name: "Tale's End",
  desc:
    'Slams the ground: every enemy within 1 tile takes {atk} of attack plus {hp} of its max HP as physical damage. ' +
    `As the protagonist, it reaches 2 tiles, stuns for ${TALES_END.stun}s, and it gains a ${pct(TALES_END.shield)} max HP shield for ${TALES_END.shieldSeconds}s.`,
  values: () => ({ atk: TALES_END.atk.map(pct), hp: TALES_END.hp.map(pct) }),
  cast(api, caster) {
    const T = TALES_END;
    const i = caster.star - 1;
    const protagonist = caster.chosen === 'storyweaver';
    const raw = caster.stats.atk * T.atk[i] + caster.maxHp * T.hp[i];
    for (const e of enemiesOn(api, caster, within(caster, protagonist ? T.protagonistRadius : T.radius))) {
      const killed = api.hit(caster, e, raw, 'physical', 'talesend');
      if (protagonist && !killed) api.stun(e, T.stun, caster);
    }
    if (protagonist) api.shield(caster, caster.maxHp * T.shield, T.shieldSeconds, 'talesend');
  },
};
