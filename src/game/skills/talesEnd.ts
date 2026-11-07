import { pct } from '../traits/format';
import { enemiesOn, within } from './areas';
import type { SkillDef } from './types';

// Altus (4g Storyweaver / Defender): a defender that hits like a truck. Per star, index 0 = 1★.
export const TALES_END = {
  ap: [6.7, 6.7, 18.5], // of magic attack, magic, to every enemy within `radius`
  radius: 1,
  defense: [30, 40, 70], // armor and magic resist it gains
  seconds: 4, // the defense lasts this long; recasting refreshes it
  // As the Storyweaver protagonist:
  protagonistRadius: 2,
  protagonistAp: [10, 10, 25],
  stun: [0.8, 1, 1.2], // seconds
  protagonistDefense: [40, 50, 100],
};

export const talesEnd: SkillDef = {
  id: 'talesend',
  name: "Tale's End",
  desc:
    'Slams the ground: every enemy within 1 tile takes {ap} of magic attack as magic damage, and it gains +{def} armor and magic resist ' +
    `for ${TALES_END.seconds}s. As the protagonist, it reaches 2 tiles, deals {pap}, stuns for {stun}, and gains +{pdef} instead.`,
  damage: { ap: 'magic', pap: 'magic' },
  values: () => ({
    ap: TALES_END.ap.map(pct),
    def: TALES_END.defense.map(String),
    pap: TALES_END.protagonistAp.map(pct),
    stun: TALES_END.stun.map((s) => `${s}s`),
    pdef: TALES_END.protagonistDefense.map(String),
  }),
  cast(api, caster) {
    const T = TALES_END;
    const i = caster.star - 1;
    const protagonist = caster.chosen === 'storyweaver';
    const raw = caster.stats.ap * (protagonist ? T.protagonistAp : T.ap)[i];
    for (const e of enemiesOn(api, caster, within(caster, protagonist ? T.protagonistRadius : T.radius))) {
      const killed = api.hit(caster, e, raw, 'magic', 'talesend');
      if (protagonist && !killed) api.stun(e, T.stun[i], caster);
    }
    const def = (protagonist ? T.protagonistDefense : T.defense)[i];
    api.buff(
      caster,
      [
        { stat: 'armor', add: def },
        { stat: 'mr', add: def },
      ],
      T.seconds,
      'talesend',
      caster,
    );
  },
};
