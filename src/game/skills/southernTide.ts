import { pct } from '../traits/format';
import { enemiesOn, facingStrip } from './areas';
import type { SkillDef } from './types';

// Roro (Plane Wanderer, Mage): Nyi Roro Kidul, Queen of the Southern Sea. Per star, index 0 = 1★.
export const SOUTHERN_TIDE = {
  ap: [2.4, 3.3, 11], // of magic attack, magic, to each enemy the wave rolls over
  stun: [0.75, 1, 1.5], // seconds, swept off their feet
  heal: [0.8, 1.1, 3.5], // of magic attack, to each ally the wave rolls over
  // Passive: the sea rises with every tide, for the rest of the fight.
  grow: 0.15, // more damage and healing per earlier cast
  maxGrow: 4, // casts that count
  width: 3,
  wave: 0.45, // seconds the wave takes to roll out (for the look of it)
};

const EFFECT = 'southerntide';

export const southernTide: SkillDef = {
  id: 'southerntide',
  name: 'Southern Tide',
  desc:
    `Summons a tidal wave that rolls out from her toward her target, ${SOUTHERN_TIDE.width} tiles wide, to the edge of the board. ` +
    'Enemies it rolls over take {ap} of magic attack as magic damage and are swept off their feet (stunned {stun}s); ' +
    'allies it rolls over heal {heal} of her magic attack. ' +
    `Passive: the sea rises with every tide: each cast makes her later tides deal and heal ${pct(SOUTHERN_TIDE.grow)} more this fight ` +
    `(up to ${pct(SOUTHERN_TIDE.grow * SOUTHERN_TIDE.maxGrow)}).`,
  damage: { ap: 'magic' },
  values: () => ({
    ap: SOUTHERN_TIDE.ap.map(pct),
    stun: SOUTHERN_TIDE.stun.map(String),
    heal: SOUTHERN_TIDE.heal.map(pct),
  }),
  cast(api, caster, target) {
    const T = SOUTHERN_TIDE;
    const i = caster.star - 1;
    const toward = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!toward) return;
    const strip = facingStrip(caster, toward, T.width);
    if (!strip.length) return;
    const rise = 1 + T.grow * Math.min(caster.skill.tides ?? 0, T.maxGrow);
    caster.skill.tides = (caster.skill.tides ?? 0) + 1;
    // The look: the wave rolls along the strip's middle line, from her to its far end (the strip runs along the
    // axis she's mostly off from her target by, as facingStrip lays it).
    const last = strip[strip.length - 1];
    const vertical = Math.abs(toward.y - caster.y) >= Math.abs(toward.x - caster.x);
    const end = vertical ? { x: caster.x, y: last.y } : { x: last.x, y: caster.y };
    api.showProjectile(caster, end, T.wave, EFFECT);
    for (const e of enemiesOn(api, caster, strip)) {
      if (e.hp <= 0) continue;
      if (!api.hit(caster, e, caster.stats.ap * T.ap[i] * rise, 'magic', EFFECT)) api.stun(e, T.stun[i], caster);
    }
    const inStrip = new Set(strip.map((c) => `${c.x},${c.y}`));
    for (const a of api.alliesOf(caster)) {
      if (a !== caster && inStrip.has(`${a.x},${a.y}`)) api.heal(a, caster.stats.ap * T.heal[i] * rise, caster);
    }
  },
};
