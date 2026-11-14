import { GRID_H, GRID_W, type Point } from '../grid';
import { pct } from '../traits/format';
import { bestLine, enemiesOn, lineThrough } from './areas';
import type { SkillApi, SkillDef, SkillFighter } from './types';

// Fanny (5g Cult of Fire / Hunter): a cable to the wall that reels her across the board. Per star, index 0 = 1★.
export const RAMPAGE = {
  flights: 5, // each to the wall along the line through the most enemies, landing on its farthest free cell
  stepSeconds: 0.2, // a slow pull, not a dash: this long per cell of each flight
  atk: [0.7, 0.75, 1.6], // of attack, physical: Tornado Strike, on each enemy she flies into (once per flight)
  bullet: [1, 1, 4], // of attack, physical: each tornado bullet, to every enemy it passes
  bulletSeconds: 0.1, // a bullet flies one cell per this
  slash: [2.7, 2.7, 6.7], // of attack, physical, to the nearest enemy after the last flight
  // 3★: sonic walls round the board; bullets bounce off them while they stand.
  wallStar: 3,
  wallSeconds: 8,
};

const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];
const onBoard = (p: Point) => p.x >= 0 && p.y >= 0 && p.x < GRID_W && p.y < GRID_H;

// Where a flight goes: the line to the wall through the most enemies (the farthest on a tie) with a free cell
// to land on. If none has one (say every enemy in her column, packed up to the wall), any straight line to a
// wall with room, the most enemies then the longest: she always flies. Empty only when she's boxed in.
function flightLine(api: SkillApi, f: SkillFighter): Point[] {
  const aimed = bestLine(api, f, Infinity, true, true);
  if (aimed.length) return aimed;
  let best: Point[] = [];
  let most = -1;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const line = lineThrough(f, { x: f.x + dx, y: f.y + dy });
      if (!line.some((p) => !api.occupant(p))) continue;
      const n = enemiesOn(api, f, line).length;
      if (n > most || (n === most && line.length > best.length)) [best, most] = [line, n];
    }
  }
  return best;
}

// The board's edge cells, where the sonic walls stand.
function rim(): Point[] {
  const cells: Point[] = [];
  for (let x = 0; x < GRID_W; x++) for (let y = 0; y < GRID_H; y++) if (!x || !y || x === GRID_W - 1 || y === GRID_H - 1) cells.push({ x, y });
  return cells;
}

interface Bullet {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

// The tornado bullets in flight for one cast: they step together, one cell per RAMPAGE.bulletSeconds, hitting
// every enemy whose cell they enter. Off the board they're gone, unless the walls are up: then they bounce back.
function bulletStorm(api: SkillApi, caster: SkillFighter, walls: () => boolean) {
  let bullets: Bullet[] = [];
  let flying = false;
  const raw = () => caster.stats.atk * RAMPAGE.bullet[caster.star - 1];
  // The picture: one straight shot from where a bullet is to the board's edge, redrawn after each bounce.
  const draw = (b: Bullet) => {
    let n = 0;
    while (onBoard({ x: b.x + b.dx * (n + 1), y: b.y + b.dy * (n + 1) })) n++;
    if (n) api.showProjectile(b, { x: b.x + b.dx * n, y: b.y + b.dy * n }, n * RAMPAGE.bulletSeconds, 'tornadobullet');
  };
  const step = () => {
    const still: Bullet[] = [];
    for (const b of bullets) {
      let next = { x: b.x + b.dx, y: b.y + b.dy };
      if (!onBoard(next)) {
        if (!walls()) continue;
        b.dx = -b.dx;
        b.dy = -b.dy;
        next = { x: b.x + b.dx, y: b.y + b.dy };
        draw({ ...b });
      }
      b.x = next.x;
      b.y = next.y;
      const there = api.occupant(b);
      if (there && there.side !== caster.side && there.hp > 0) api.hit(caster, there, raw(), 'physical', 'tornadobullet');
      still.push(b);
    }
    bullets = still;
    flying = bullets.length > 0;
    if (flying) api.repeat(caster, RAMPAGE.bulletSeconds, 1, step);
  };
  return {
    // Four bullets from `from`: up, down, left and right.
    fire(from: Point) {
      for (const d of DIRS) {
        const b = { x: from.x, y: from.y, ...d };
        bullets.push(b);
        draw(b);
      }
      if (!flying) {
        flying = true;
        api.repeat(caster, RAMPAGE.bulletSeconds, 1, step);
      }
    },
  };
}

export const rampage: SkillDef = {
  id: 'rampage',
  name: 'Rampage',
  desc:
    `Shoots a cable to the wall and reels herself in, ${RAMPAGE.flights} times, each along the line through the most enemies ` +
    '(the farthest on a tie). Every enemy she flies into takes a Tornado Strike for {atk} of attack as physical damage. As she sets ' +
    'off each time, she fires tornado bullets up, down, left and right: each hits every enemy it passes for {bullet} of attack as ' +
    'physical damage. After the last flight she slashes the nearest enemy for {slash} of attack as physical damage. ' +
    `She can be hit during the skill. At 3★ she raises sonic walls round the board for ${RAMPAGE.wallSeconds}s: her bullets bounce ` +
    'off them and keep ricocheting while they stand.',
  damage: { atk: 'physical', bullet: 'physical', slash: 'physical' },
  values: () => ({ atk: RAMPAGE.atk.map(pct), bullet: RAMPAGE.bullet.map(pct), slash: RAMPAGE.slash.map(pct) }),
  cast(api, caster) {
    const R = RAMPAGE;
    const i = caster.star - 1;
    const strike = caster.stats.atk * R.atk[i];
    // 3★: the sonic walls, from the cast.
    let wallsUp = caster.star >= R.wallStar;
    if (wallsUp) api.showGround(rim(), R.wallSeconds, 'sonicwall');
    const storm = bulletStorm(api, caster, () => wallsUp);
    let left = R.flights;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const near = api.nearestEnemy(caster);
      if (near) api.hit(caster, near, caster.stats.atk * R.slash[i], 'physical', 'rampageslash');
      api.busy(caster, false);
    };
    // One flight (see flightLine). She lands on the line's farthest free cell at once, drawn as a slow arc; each enemy on the way is struck as
    // the arc passes it. The next flight sets off when she lands.
    const fly = () => {
      if (done) return;
      const line = left > 0 ? flightLine(api, caster) : [];
      if (!line.length) return finish();
      left--;
      storm.fire({ x: caster.x, y: caster.y });
      const landing = [...line].reverse().find((p) => !api.occupant(p))!;
      const steps = line.findIndex((p) => p.x === landing.x && p.y === landing.y) + 1;
      // The cable runs to the wall: enemies past her landing (against the wall) are struck as she lands.
      line.forEach((p, k) => {
        const there = api.occupant(p);
        if (!there || there.side === caster.side) return;
        api.repeat(caster, Math.min(k + 1, steps) * R.stepSeconds, 1, () => {
          if (there.hp > 0) api.hit(caster, there, strike, 'physical', 'rampage');
        });
      });
      api.showLeap(caster, landing, steps * R.stepSeconds);
      api.dashTo(caster, landing, false);
      api.repeat(caster, steps * R.stepSeconds, 1, left > 0 ? fly : finish);
    };
    api.busy(caster, true);
    fly();
    if (wallsUp) api.repeat(caster, R.wallSeconds, 1, () => (wallsUp = false));
  },
};
