import { GRID_H, GRID_W, type Point } from '../grid';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Mythweaver (4g Mage): drops a beast where the enemies are thickest. Per star, index 0 = 1★.
export const MYTH_MADE_FLESH = {
  beast: 'mythbeast',
  landing: [2, 2.4, 5], // of magic attack, magic, to enemies in the 3x3 it lands in
  hp: 0.6, // of Mythweaver's max hp
  atk: [0.5, 0.6, 1], // of Mythweaver's magic attack: the beast's attack
  // As the Storyweaver protagonist:
  protagonistAtk: 2, // x the beast's attack
  burn: [0.3, 0.35, 0.7], // of magic attack per second, magic, on the landing 3x3
  burnSeconds: 4,
};

// The free cell with the most enemies in the 3x3 around it (ties: the one nearest the caster).
export function densestDrop(api: SkillApi, caster: SkillFighter): Point | null {
  let best: { p: Point; n: number } | null = null;
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_H; y++) {
      const p = { x, y };
      if (api.occupant(p)) continue;
      const n = enemiesOn(api, caster, around(p)).length;
      if (!n) continue;
      const nearer = best && Math.max(Math.abs(p.x - caster.x), Math.abs(p.y - caster.y)) < Math.max(Math.abs(best.p.x - caster.x), Math.abs(best.p.y - caster.y));
      if (!best || n > best.n || (n === best.n && nearer)) best = { p, n };
    }
  }
  return best?.p ?? null;
}

export const mythMadeFlesh: SkillDef = {
  id: 'mythmadeflesh',
  name: 'Myth Made Flesh',
  desc:
    'Drops a Myth Beast like a meteor on the spot with the most enemies around it: enemies in the 3x3 take {landing} of magic attack as magic damage. ' +
    `The beast (with ${pct(MYTH_MADE_FLESH.hp)} of its max HP) then fights on its own, attacking with {atk} of its magic attack. ` +
    `As the protagonist, the landing sets the 3x3 ablaze ({burn} of magic attack per second for ${MYTH_MADE_FLESH.burnSeconds}s) ` +
    `and the beast hits ${MYTH_MADE_FLESH.protagonistAtk}x as hard.`,
  values: () => ({ landing: MYTH_MADE_FLESH.landing.map(pct), atk: MYTH_MADE_FLESH.atk.map(pct), burn: MYTH_MADE_FLESH.burn.map(pct) }),
  cast(api, caster) {
    const M = MYTH_MADE_FLESH;
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (!spot) return;
    const protagonist = caster.chosen === 'storyweaver';
    const zone = [spot, ...around(spot)];
    api.showProjectile({ x: spot.x, y: caster.side === 0 ? 0 : GRID_H - 1 }, spot, 0.25, 'mythmadeflesh');
    for (const e of enemiesOn(api, caster, zone)) api.hit(caster, e, caster.stats.ap * M.landing[i], 'magic', 'mythmadeflesh');
    if (protagonist) api.burn(caster, zone, caster.stats.ap * M.burn[i], 'magic', M.burnSeconds, 'mythburn');
    const atk = caster.stats.ap * M.atk[i] * (protagonist ? M.protagonistAtk : 1);
    api.summon(caster, M.beast, { hpShare: M.hp, atk, at: spot });
  },
};
