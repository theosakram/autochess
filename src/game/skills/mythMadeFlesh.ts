import { GRID_H, GRID_W, type Point } from '../grid';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Vex (4g Storyweaver / Mage): drops a beast where the enemies are thickest. Per star, index 0 = 1★.
export const MYTH_MADE_FLESH = {
  beast: 'mythbeast',
  landing: [2.1, 2.1, 5.45], // of magic attack, magic, to enemies in the 3x3 it lands in
  stun: [0.6, 0.8, 1], // seconds, to enemies in the landing 3x3
  hp: 0.6, // of Vex's max hp
  atk: [0.5, 0.6, 1], // of Vex's magic attack: the beast's attack
  // As the Storyweaver protagonist:
  protagonistLanding: [2.45, 2.5, 5.45], // of magic attack, magic, extra on the landing
  aura: [1, 1, 2], // of magic attack, magic, every second to enemies around the beast
  auraSeconds: 4,
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
    'Drops a Myth Beast like a meteor on the spot with the most enemies around it: enemies in the 3x3 take {landing} of magic attack ' +
    'as magic damage and are stunned for {stun}s. ' +
    `The beast (with ${pct(MYTH_MADE_FLESH.hp)} of its max HP) then fights on its own, attacking with {atk} of its magic attack. ` +
    'As the protagonist, the landing deals {extra} of magic attack more, and for ' +
    `${MYTH_MADE_FLESH.auraSeconds}s the beast deals {aura} of magic attack as magic damage every second to enemies around it.`,
  damage: { landing: 'magic', extra: 'magic', aura: 'magic' },
  values: () => ({
    landing: MYTH_MADE_FLESH.landing.map(pct),
    stun: MYTH_MADE_FLESH.stun.map(String),
    atk: MYTH_MADE_FLESH.atk.map(pct),
    extra: MYTH_MADE_FLESH.protagonistLanding.map(pct),
    aura: MYTH_MADE_FLESH.aura.map(pct),
  }),
  cast(api, caster) {
    const M = MYTH_MADE_FLESH;
    const i = caster.star - 1;
    const spot = densestDrop(api, caster);
    if (!spot) return;
    const protagonist = caster.chosen === 'storyweaver';
    const zone = [spot, ...around(spot)];
    const landing = caster.stats.ap * (M.landing[i] + (protagonist ? M.protagonistLanding[i] : 0));
    api.showProjectile({ x: spot.x, y: caster.side === 0 ? 0 : GRID_H - 1 }, spot, 0.25, 'mythmadeflesh');
    for (const e of enemiesOn(api, caster, zone)) {
      api.hit(caster, e, landing, 'magic', 'mythmadeflesh');
      if (e.hp > 0) api.stun(e, M.stun[i], caster);
    }
    const beast = api.summon(caster, M.beast, { hpShare: M.hp, atk: caster.stats.ap * M.atk[i], at: spot });
    if (!protagonist || !beast) return;
    // The aura is Vex's damage, centred on wherever the beast stands; it stops if the beast falls.
    api.repeat(caster, 1, M.auraSeconds, () => {
      if (beast.hp <= 0) return;
      for (const e of enemiesOn(api, caster, around(beast))) api.hit(caster, e, caster.stats.ap * M.aura[i], 'magic', 'mythaura');
    });
  },
};
