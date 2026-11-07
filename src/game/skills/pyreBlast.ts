import { pct } from '../traits/format';
import { coneAhead, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Lola (4g Cult of Fire / Dauntless). Per star, index 0 = 1★.
export const PYRE_BLAST = {
  atk: [4.35, 4.35, 12.65], // of attack...
  hp: [0.05, 0.05, 0.1], // ...plus this share of her max hp, physical, to each enemy in the cone ahead
  depth: 2, // the cone: 3 cells wide next to her, 5 wide beyond
  stun: [1, 1, 2], // seconds
  shield: [0.15, 0.15, 0.25], // of her max hp
  seconds: 4,
};

export const pyreBlast: SkillDef = {
  id: 'pyreblast',
  name: 'Pyre Blast',
  desc:
    `Smashes a cone opening out from her toward her target (${PYRE_BLAST.depth} rows deep, widening): every enemy in it takes {atk} of attack plus {hp} of her max HP as physical damage ` +
    `and is stunned for {stun}. She then gains a shield of {shield} of her max HP for ${PYRE_BLAST.seconds}s.`,
  damage: { atk: 'physical', hp: 'physical' },
  values: () => ({
    atk: PYRE_BLAST.atk.map(pct),
    hp: PYRE_BLAST.hp.map(pct),
    stun: PYRE_BLAST.stun.map((s) => `${s}s`),
    shield: PYRE_BLAST.shield.map(pct),
  }),
  cast(api, caster, target) {
    const i = caster.star - 1;
    const raw = caster.stats.atk * PYRE_BLAST.atk[i] + caster.maxHp * PYRE_BLAST.hp[i];
    const toward = target.hp > 0 ? target : (api.nearestEnemy(caster) ?? target);
    for (const e of enemiesOn(api, caster, coneAhead(caster, toward, PYRE_BLAST.depth))) {
      if (!api.hit(caster, e, raw, 'physical', 'pyreblast')) api.stun(e, PYRE_BLAST.stun[i], caster);
    }
    api.shield(caster, caster.maxHp * PYRE_BLAST.shield[i], PYRE_BLAST.seconds, 'pyreblast');
  },
};
