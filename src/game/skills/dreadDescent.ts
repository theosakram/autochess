import { pct } from '../traits/format';
import { around, enemiesOn, middleCell } from './areas';
import { densestDrop } from './mythMadeFlesh';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Alice (5g Spectre / Dauntless). Per star, index 0 = 1★.
export const DREAD_DESCENT = {
  // First, a curse on her target's tile and the tiles around it.
  dot: [0.5, 0.5, 2], // of magic attack, magic, every `dotEvery` seconds to each enemy standing there
  dotEvery: 0.5,
  dotSeconds: 1.5, // then she leaps
  // The leap: onto the spot with the most enemies around it (at 3 stars, the middle of the board).
  ap: [2.45, 2.45, 12.15], // of magic attack...
  hp: [0.1, 0.1, 0.15], // ...plus this share of her max hp, magic, to each enemy around where she lands
  stun: 1, // seconds
  heal: [1.15, 1.95, 12.85], // of the damage the leap dealt
  centerStar: 3,
};

function leap(api: SkillApi, caster: SkillFighter): void {
  const D = DREAD_DESCENT;
  const i = caster.star - 1;
  const center = caster.star >= D.centerStar;
  const spot = center ? middleCell(api, caster) : densestDrop(api, caster);
  if (spot && (spot.x !== caster.x || spot.y !== caster.y)) api.dashTo(caster, spot);
  const raw = caster.stats.ap * D.ap[i] + caster.maxHp * D.hp[i];
  const before = caster.dealt;
  // At 3 stars the landing hits every enemy on the board.
  for (const e of center ? api.enemiesOf(caster) : enemiesOn(api, caster, around(caster))) {
    if (!api.hit(caster, e, raw, 'magic', 'dreaddescent')) api.stun(e, D.stun, caster);
  }
  const dealt = caster.dealt - before;
  if (dealt > 0) api.heal(caster, dealt * D.heal[i]);
}

export const dreadDescent: SkillDef = {
  id: 'dreaddescent',
  name: 'Dread Descent',
  desc:
    `Curses her target's tile and the tiles around it: every ${DREAD_DESCENT.dotEvery}s for ${DREAD_DESCENT.dotSeconds}s, ` +
    'each enemy there takes {dot} of magic attack as magic damage. ' +
    'Then she leaps onto the spot with the most enemies around it: every enemy around where she lands takes {ap} of magic attack ' +
    `plus {hp} of her max HP as magic damage and is stunned for ${DREAD_DESCENT.stun}s, and she heals for {heal} of the damage the leap dealt. ` +
    `At ${DREAD_DESCENT.centerStar}★ she leaps to the middle of the board instead, and the landing hits every enemy on the board.`,
  damage: { dot: 'magic', ap: 'magic', hp: 'magic' },
  values: () => ({
    dot: DREAD_DESCENT.dot.map(pct),
    ap: DREAD_DESCENT.ap.map(pct),
    hp: DREAD_DESCENT.hp.map(pct),
    heal: DREAD_DESCENT.heal.map(pct),
  }),
  cast(api, caster, target) {
    const D = DREAD_DESCENT;
    const center = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (center) {
      // `burn` takes damage per second and ticks every 0.5s.
      const perSecond = caster.stats.ap * D.dot[caster.star - 1] * (1 / D.dotEvery);
      api.burn(caster, [{ x: center.x, y: center.y }, ...around(center)], perSecond, 'magic', D.dotSeconds, 'dreaddescentdot');
    }
    api.repeat(caster, D.dotSeconds, 1, () => leap(api, caster));
  },
};
