import { GRID_H, GRID_W, type Point } from '../grid';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import { densestDrop } from './mythMadeFlesh';
import { adaptivePower } from '../stats';
import type { SkillDef } from './types';

// Boss Alpha (7g Spectre). Per star, index 0 = 1★.
export const SPECTRAL_CATACLYSM = {
  impact: [1.6, 2, 5], // of the higher of attack and magic attack, enemies around where it lands
  leap: 0.5, // seconds in the air
  delay: 0.6, // seconds from the landing to the lasers (it charges up)
  beamStep: 0.1, // seconds each laser takes to cross one tile
  beam: [2.8, 3.4, 9], // of the same, each enemy a laser reaches
};

// The 8 directions the lasers fire: straight and diagonal.
export const BEAM_DIRS: Point[] = [
  { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
  { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
];

const onBoard = (p: Point) => p.x >= 0 && p.x < GRID_W && p.y >= 0 && p.y < GRID_H;

// The cells of one laser from `center` to the board's edge, nearest first.
export function beamCells(center: Point, dir: Point): Point[] {
  const cells: Point[] = [];
  for (let k = 1; ; k++) {
    const p = { x: center.x + dir.x * k, y: center.y + dir.y * k };
    if (!onBoard(p)) return cells;
    cells.push(p);
  }
}

export const spectralCataclysm: SkillDef = {
  id: 'spectralcataclysm',
  name: 'Spectral Cataclysm',
  desc:
    'Leaps into the thick of the enemy (the spot with the most of them around it). Landing hits the tiles around it for {impact} of its higher of attack and magic attack. ' +
    `It charges for ${SPECTRAL_CATACLYSM.delay}s, then fires lasers in all 8 directions to the edge of the board, piercing: ` +
    'each enemy a laser reaches takes {beam} of its higher of attack and magic attack. ' +
    'Adaptive damage: magic if its magic attack is the higher, else physical.',
  damage: { impact: 'adaptive', beam: 'adaptive' },
  values: () => ({ impact: SPECTRAL_CATACLYSM.impact.map(pct), beam: SPECTRAL_CATACLYSM.beam.map(pct) }),
  // Committed from the jump to the last laser: no walking, no attacks.
  cast(api, caster) {
    const S = SPECTRAL_CATACLYSM;
    const i = caster.star - 1;
    const power = () => adaptivePower(caster.stats);
    api.busy(caster, true);
    const spot = densestDrop(api, caster);
    if (spot) {
      api.showLeap(caster, spot, S.leap);
      api.dashTo(caster, spot, false);
    }
    const center = { x: caster.x, y: caster.y };
    const beams = BEAM_DIRS.map((d) => beamCells(center, d)).filter((b) => b.length);
    const reach = Math.max(0, ...beams.map((b) => b.length));
    const land = () => {
      api.showProjectile(center, center, S.delay, 'spectralcharge'); // the shockwave and the charge-up
      for (const e of enemiesOn(api, caster, around(center))) api.hit(caster, e, power() * S.impact[i], 'adaptive', 'spectralimpact');
      api.repeat(caster, S.delay, 1, fire);
    };
    // Each laser crosses a tile per beamStep; an enemy is hit as its front gets there (once, even if two cross it).
    const fire = () => {
      if (!reach) return api.busy(caster, false);
      for (const b of beams) api.showProjectile(center, b[b.length - 1], b.length * S.beamStep, 'spectralbeam');
      let k = 0;
      api.repeat(caster, S.beamStep, reach, () => {
        const ring = beams.flatMap((b) => (b[k] ? [b[k]] : []));
        k++;
        for (const e of enemiesOn(api, caster, ring)) if (e.hp > 0) api.hit(caster, e, power() * S.beam[i], 'adaptive', 'spectralcataclysm');
        if (k === reach) api.busy(caster, false);
      });
    };
    if (spot) api.repeat(caster, S.leap, 1, land);
    else land();
  },
};
