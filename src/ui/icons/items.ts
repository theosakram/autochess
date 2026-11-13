// Hand-drawn item icons (64x64), replacing an item's emoji where two items shared one (both were ⚔️).
// Same look as the commander portraits: flat shapes with a dark outline, so they read at 18px in a gear slot.
// Anything not here keeps its emoji (ItemDef.icon). Keyed by the base item's id: an enhanced version uses its base's.

const OUTLINE = '#1d1622';
const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">` +
  `<g stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

// The board draws these through Pixi, whose SVG parser ignores `transform`: a tilted shape gets its rotation
// baked into the numbers. `d`: absolute M/L/C/Z commands only.
// `deg`: clockwise, about the middle (32, 32).
const turn = (x: number, y: number, deg = 45) => {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [x - 32, y - 32];
  return [32 + dx * Math.cos(a) - dy * Math.sin(a), 32 + dx * Math.sin(a) + dy * Math.cos(a)].map((n) => +n.toFixed(2));
};
const tilt = (d: string, deg = 45) =>
  d.replace(/(-?\d*\.?\d+)[ ,](-?\d*\.?\d+)/g, (_, x, y) => turn(Number(x), Number(y), deg).join(' '));
const at = (x: number, y: number, deg = 45) => {
  const [cx, cy] = turn(x, y, deg);
  return `cx="${cx}" cy="${cy}"`;
};

// A smooth line through points (each corner rounded off by a curve to the next midpoint), as absolute M/Q/L.
const smooth = (pts: [number, number][]) => {
  const mid = (i: number) => pts[i].map((v, k) => (v + pts[i + 1][k]) / 2).join(' ');
  let d = `M${pts[0].join(' ')} L${mid(0)}`;
  for (let i = 1; i < pts.length - 1; i++) d += ` Q${pts[i].join(' ')} ${mid(i)}`;
  return `${d} L${pts[pts.length - 1].join(' ')}`;
};

// A shape drawn about (0, 0), then turned `deg` clockwise and moved to (cx, cy). `d`: absolute commands only.
const pose = (d: string, deg: number, cx: number, cy: number) =>
  d.replace(/(-?\d*\.?\d+)[ ,](-?\d*\.?\d+)/g, (_, x, y) => {
    const [px, py] = turn(Number(x) + 32, Number(y) + 32, deg);
    return `${+(px - 32 + cx).toFixed(2)} ${+(py - 32 + cy).toFixed(2)}`;
  });

// A line drawn twice, outline under colour, so stroke-only shapes get the same dark rim as the filled ones.
const line = (d: string, color: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${OUTLINE}" stroke-width="${width + 3}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"/>`;

// A star/burst polygon: n points alternating between radius r1 (tips) and r2 (dips).
function burst(cx: number, cy: number, n: number, r1: number, r2: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

// A chain link, upright about (0, 0), open at the top (where it broke).
const BROKEN_LINK = 'M6 -4 L6 5 C6 13 -6 13 -6 5 L-6 -5 C-6 -12 4 -13 5.5 -8';

// Gustiwana's colours (its badge): maroon and rose, with Javanese gold and teak.
const MAROON = '#5c1629';
const ROSE = '#d49198';
const GOLD = '#d9a441';
const TEAK = '#7a4a2a';

// The keris's luk (its waves): the blade snakes as it narrows, both edges together. Drawn upright, point at
// the top, then tilted.
const KERIS_EDGE: [number, number][] = [[32, 3], [34.6, 9], [32.6, 15], [35.4, 21], [33, 27], [36, 33], [34, 39], [36, 43]];
const kerisBlade = () => {
  const right = KERIS_EDGE;
  const left = right.map(([x, y], i): [number, number] => [i === 0 ? x : x - 4.5 - i * 0.25, y]).reverse();
  return `${smooth(right)} L${smooth(left).slice(1)} Z`;
};

export const ITEM_SVGS: Record<string, string> = {
  // Retribution (basic): a steel broadsword, point down, in a crimson flame of vengeance.
  retribution: svg(
    `<path d="M32 50c-11 0-19-7-19-17 0-7 4-11 6-17 2 4 3 7 6 8-1-7 2-14 7-20 1 6 3 9 6 12 1-4 3-6 5-8 2 6 5 10 5 17 0 10-5 25-16 25z" fill="#d6402f"/>` +
      `<path d="M32 46c-7 0-12-5-12-11 0-4 2-7 4-10 1 3 3 5 5 5 0-4 1-8 4-11 1 4 3 6 5 8 1-2 2-3 3-4 2 4 3 7 3 11 0 7-5 12-12 12z" fill="#f59a3a" stroke="none"/>` +
      `<path d="M28 24h8v26l-4 10-4-10z" fill="#e4ecf6"/><path d="M32 24h4v26l-4 10z" fill="#b9c6d8"/>` +
      `<path d="M32 27v27" fill="none" stroke="#8a97ab" stroke-width="1.5"/>` +
      `<path d="M18 19h28l-3 5H21z" fill="#6b7383"/>` +
      `<rect x="29" y="7" width="6" height="12" rx="1" fill="#3a2a22"/><circle cx="32" cy="6" r="3.5" fill="#6b7383"/>`,
  ),
  // Aegis (basic): a blue heater shield, silver rimmed, a gold boss; the pale arcs either side are the shields it
  // hands the allies left and right of the holder.
  aegis: svg(
    line('M9 19 C4 27 4 37 9 45', '#9fd0ff', 2.5) +
      line('M55 19 C60 27 60 37 55 45', '#9fd0ff', 2.5) +
      `<path d="M32 5 L52 11 C52 34 46 48 32 58 C18 48 12 34 12 11 Z" fill="#c9d2e0"/>` +
      `<path d="M32 10.5 L47 15 C47 33 42 44 32 52 C22 44 17 33 17 15 Z" fill="#2f5fc4"/>` +
      `<path d="M32 10.5 L47 15 C47 33 42 44 32 52 Z" fill="#4a80e6" stroke="none"/>` +
      `<circle cx="32" cy="29" r="7" fill="${GOLD}"/>` +
      `<circle cx="30.5" cy="27.5" r="2.6" fill="#fff1b8" stroke="none"/>`,
  ),
  // Inspire (basic): a brass herald's trumpet with a red banner, sounding: attack speed. Drawn level, then
  // raised to point up and right.
  inspire: svg(
    line(tilt('M0 33 L33 33', -30), '#e3b341', 4) +
      line(tilt('M7 33 C7 42 23 42 23 33', -30), '#c99a2e', 3) +
      `<path d="${tilt('M11 36 L27 36 L27 47 L19 43 L11 47 Z', -30)}" fill="#c8243a"/>` +
      `<path d="${tilt('M31 30.5 L46 21 C49.5 27 49.5 39 46 45 L31 35.5 Z', -30)}" fill="#f2c14e"/>` +
      `<path d="${tilt('M46 21 C49.5 27 49.5 39 46 45', -30)}" fill="none" stroke="#fff1b8" stroke-width="1.5"/>` +
      `<circle ${at(-2, 33, -30)} r="2.6" fill="#e3b341"/>` +
      line(tilt('M51.5 26 C54 30 54 36 51.5 40', -30), '#fff1b8', 2) +
      line(tilt('M55.5 22 C59 28 59 38 55.5 44', -30), '#fff1b8', 2),
  ),
  // Purify (basic): a chain snapping in a burst of white light: nothing can hold the holder (no control, no
  // displacement).
  purify: svg(
    `<polygon points="${burst(32, 32, 8, 26, 9)}" fill="#fff1b8" stroke="none"/>` +
      `<polygon points="${burst(32, 32, 8, 15, 6)}" fill="#ffffff" stroke="none"/>` +
      line(pose(BROKEN_LINK, 45, 22, 42), '#d8dee8', 4.5) +
      line(pose(BROKEN_LINK, 225, 42, 22), '#d8dee8', 4.5) +
      `<path d="M29 29 L35 35 M35 29 L29 35" fill="none" stroke="${GOLD}" stroke-width="2"/>`,
  ),
  // Revitalize (basic): the Healing Spring it summons. A stone basin, its fountain arcing teal, a green plus.
  revitalize: svg(
    line('M32 40 L32 13', '#4fd1c5', 4) +
      `<path d="M32 4 C35 8 36 10 36 12 C36 14.5 34 16 32 16 C30 16 28 14.5 28 12 C28 10 29 8 32 4 Z" fill="#9ff0e6"/>` +
      line('M32 29 C26 25 19 28 16 36', '#4fd1c5', 3) +
      line('M32 29 C38 25 45 28 48 36', '#4fd1c5', 3) +
      `<path d="M10 42 L54 42 C52 52 44 57 32 57 C20 57 12 52 10 42 Z" fill="#8f99a8"/>` +
      `<path d="M8 39 L56 39 L56 44 L8 44 Z" fill="#b6c0cc"/>` +
      `<path d="M11 39 C20 35 44 35 53 39 Z" fill="#3bb3a8"/>` +
      `<path d="M48 4 L54 4 L54 9 L59 9 L59 15 L54 15 L54 20 L48 20 L48 15 L43 15 L43 9 L48 9 Z" fill="#5fd47a"/>` +
      `<circle cx="10" cy="24" r="1.8" fill="#9ff0e6" stroke="none"/><circle cx="56" cy="30" r="1.5" fill="#9ff0e6" stroke="none"/>`,
  ),
  // --- Physical equipment: each its own shape and colour, so a row of them doesn't read as five swords. ---
  // Berserker's Fury: a horned steel helm, eyes burning red through its slits (crit chance, crit damage).
  berserkerfury: svg(
    `<path d="M15 32 C6 30 2 20 6 8 C9 18 13 23 18 25 Z" fill="#efe3c4"/>` +
      `<path d="M49 32 C58 30 62 20 58 8 C55 18 51 23 46 25 Z" fill="#efe3c4"/>` +
      `<path d="M14 40 C14 22 22 12 32 12 C42 12 50 22 50 40 L50 50 C44 54 20 54 14 50 Z" fill="#9aa4b4"/>` +
      `<path d="M32 12 C42 12 50 22 50 40 L50 50 C44 53 38 54 32 54 Z" fill="#7c8696" stroke="none"/>` +
      `<path d="M14 27 C24 23 40 23 50 27 L50 31.5 C40 27.5 24 27.5 14 31.5 Z" fill="#b8863a"/>` +
      `<path d="M18 33 L28 36 L28 39.5 L19 37.5 Z" fill="#ff3b30"/><path d="M46 33 L36 36 L36 39.5 L45 37.5 Z" fill="#ff3b30"/>` +
      `<path d="M30 30 L34 30 L33.5 50 L30.5 50 Z" fill="#6b7383"/>`,
  ),
  // Blade of Despair: an obsidian falchion with a crimson edge, bleeding (more damage to the wounded).
  bladeofdespair: svg(
    `<path d="M30 5 C41 11 43 26 38.5 42 L27.5 42 C30 30 30 18 30 5 Z" fill="#2a1f33"/>` +
      `<path d="M31.5 8 C40 14 41.5 27 37.5 40.5" fill="none" stroke="#e0283c" stroke-width="2"/>` +
      `<path d="M47 27 C49 31 50 33 50 34.5 C50 36.5 48.5 38 47 38 C45.5 38 44 36.5 44 34.5 C44 33 45 31 47 27 Z" fill="#d6283a"/>` +
      `<path d="M51 42 C52.3 44.5 53 46 53 47 C53 48.4 52 49.4 51 49.4 C50 49.4 49 48.4 49 47 C49 46 49.7 44.5 51 42 Z" fill="#d6283a"/>` +
      `<path d="M19 42 L45 42 L43 47 L21 47 Z" fill="#5a1a2a"/>` +
      `<path d="M30 47 L34 47 L34 57 L30 57 Z" fill="#1a1418"/><circle cx="32" cy="59" r="3.2" fill="#d6283a"/>`,
  ),
  // Demon Hunter Sword: a silver sword with violet runes, demon horns curling off its guard. Tilted up-left.
  demonhuntersword: svg(
    `<path d="${tilt('M32 3 L36.5 9 L36.5 41 L27.5 41 L27.5 9 Z', -35)}" fill="#dfe6f0"/>` +
      `<path d="${tilt('M32 3 L36.5 9 L36.5 41 L32 41 Z', -35)}" fill="#b9c6d8"/>` +
      `<path d="${tilt('M32 10 L32 38', -35)}" fill="none" stroke="#9b4dff" stroke-width="2.5"/>` +
      `<path d="${tilt('M27 45 C20 45 16 38 17 30 C19 36 23 40 28 40 Z', -35)}" fill="#5a2a6e"/>` +
      `<path d="${tilt('M37 45 C44 45 48 38 47 30 C45 36 41 40 36 40 Z', -35)}" fill="#5a2a6e"/>` +
      `<path d="${tilt('M22 41 L42 41 L42 46 L22 46 Z', -35)}" fill="#3a2448"/>` +
      `<circle ${at(32, 43.5, -35)} r="3" fill="#b56cff"/>` +
      `<path d="${tilt('M29.5 46 L34.5 46 L34.5 56 L29.5 56 Z', -35)}" fill="#2a2030"/>` +
      `<path d="${tilt('M28 58.5 L32 55.5 L36 58.5 L32 61.5 Z', -35)}" fill="#b56cff"/>`,
  ),
  // Golden Staff: a golden rod with red-banded ends, whirling (attack speed that builds with each hit).
  goldenstaff: svg(
    `<path d="M24 50 L33 40 M30 54 L37 46 M17 45 L25 36" fill="none" stroke="#fff1b8" stroke-width="2"/>` +
      line('M10 56 L54 8', '#e3b341', 6) +
      `<path d="M12.5 52 L51.5 10" fill="none" stroke="#fff1b8" stroke-width="1.5"/>` +
      line('M10 56 L14.4 51.2', '#c8243a', 6) +
      line('M49.6 12.8 L54 8', '#c8243a', 6),
  ),
  // Haas's Claw: three steel talons on a leather gauntlet, their tips bloodied (lifesteal).
  haasclaw: svg(
    [20, 32, 44]
      .map(
        (x) =>
          `<path d="M${x - 3} 45 C${x - 3} 31 ${x + 2} 18 ${x + 6} 5 C${x + 4.5} 18 ${x + 3.5} 31 ${x + 3.5} 45 Z" fill="#d8dee8"/>` +
          `<path d="M${x + 6} 5 C${x + 4.8} 12 ${x + 4.1} 16 ${x + 3.9} 21 L${x + 0.3} 20 C${x + 1.6} 14.5 ${x + 3.6} 9.5 ${x + 6} 5 Z" fill="#e0283c" stroke="none"/>`,
      )
      .join('') +
      `<path d="M13 44 L51 44 L49 58 L15 58 Z" fill="#6b4426"/>` +
      `<path d="M14.5 51 L49.5 51" fill="none" stroke="#4a2e18" stroke-width="1.5"/>` +
      [20, 32, 44].map((x) => `<circle cx="${x}" cy="47.5" r="2" fill="${GOLD}"/>`).join(''),
  ),
  // Sea Halberd: a sea-green halberd, spear point, crescent axe and back spike, gold bindings (it pierces armor
  // and cuts healing). Tilted to the right.
  seahalberd: svg(
    line(tilt('M32 14 L32 62', 30), '#2f5d6e', 4) +
      `<path d="${tilt('M32 2 L36 12 L32 16 L28 12 Z', 30)}" fill="#9fe3e6"/>` +
      `<path d="${tilt('M34 16 C44 14 50 20 52 31 C46 28 40 30 34 32 Z', 30)}" fill="#4fb6c8"/>` +
      `<path d="${tilt('M37 24 C40 21.5 43 21.5 45 24 C47 26.5 49 26.5 50.5 25', 30)}" fill="none" stroke="#e6fbff" stroke-width="1.4"/>` +
      `<path d="${tilt('M30 19 L21 23.5 L30 27 Z', 30)}" fill="#4fb6c8"/>` +
      `<path d="${tilt('M29.5 15 L34.5 15 L34.5 18 L29.5 18 Z', 30)}" fill="${GOLD}"/>` +
      `<path d="${tilt('M29.5 31 L34.5 31 L34.5 34 L29.5 34 Z', 30)}" fill="${GOLD}"/>`,
  ),
  // War Axe: a double-bitted battle axe, steel on a bronze socket and a teak haft. Tilted to the left.
  waraxe: svg(
    line(tilt('M32 14 L32 60', -25), TEAK, 4.5) +
      `<path d="${tilt('M35 14 C42 12 47 12 51 9 C53.5 17 53.5 27 51 35 C47 31.5 42 30.5 35 29.5 Z', -25)}" fill="#c3cad6"/>` +
      `<path d="${tilt('M29 14 C22 12 17 12 13 9 C10.5 17 10.5 27 13 35 C17 31.5 22 30.5 29 29.5 Z', -25)}" fill="#c3cad6"/>` +
      `<path d="${tilt('M51 9 C53.5 17 53.5 27 51 35', -25)}" fill="none" stroke="#eef2f8" stroke-width="1.6"/>` +
      `<path d="${tilt('M13 9 C10.5 17 10.5 27 13 35', -25)}" fill="none" stroke="#eef2f8" stroke-width="1.6"/>` +
      `<path d="${tilt('M30 10 L32 4 L34 10 Z', -25)}" fill="#c3cad6"/>` +
      `<path d="${tilt('M28 10 L36 10 L36 33 L28 33 Z', -25)}" fill="#a87a3a"/>` +
      `<path d="${tilt('M29.5 48 L34.5 48 M29.5 52 L34.5 52 M29.5 56 L34.5 56', -25)}" fill="none" stroke="#3a2418" stroke-width="1.5"/>`,
  ),
  // --- Magic equipment ---
  // Divine Glaive: a silver crescent-moon blade on an indigo shaft, a star in its hollow (magic penetration).
  divineglaive: svg(
    line(tilt('M32 35 L32 62', 30), '#2b3a6e', 4) +
      `<path d="${tilt('M21 8 C34 1 49 10 47 26 C45 35 37 39 28 37 C36 32 40 26 38 18 C36 12 30 9 21 8 Z', 30)}" fill="#dcd6ff"/>` +
      `<path d="${tilt('M28 37 C36 32 40 26 38 18 C36 12 30 9 21 8 C31 11 35 18 34 25 C33 31 31 34 28 37 Z', 30)}" fill="#a99cf0" stroke="none"/>` +
      `<path d="${tilt('M29 34 L35 34 L35 39 L29 39 Z', 30)}" fill="${GOLD}"/>` +
      `<polygon points="${burst(20, 33, 4, 6, 2)}" fill="#fff1b8"/>`,
  ),
  // Glowing Wand: a short gold wand crowned with a blazing sun orb (its hits burn).
  glowingwand: svg(
    line('M13 57 L35 31', '#b8863a', 4) +
      line('M13 57 L19 50', '#5a3a1a', 4.5) +
      `<polygon points="${burst(42, 22, 10, 18, 10)}" fill="#ff9a3a"/>` +
      `<circle cx="42" cy="22" r="9" fill="#ffd45a"/>` +
      `<circle cx="42" cy="22" r="4.5" fill="#fffbe6" stroke="none"/>`,
  ),
  // Holy Crystal: a rose crystal, faceted, under a gold halo (skill damage).
  holycrystal: svg(
    line('M21 8 C21 3 43 3 43 8 C43 13 21 13 21 8 Z', GOLD, 2.5) +
      `<path d="M32 16 L44 26 L32 31 L20 26 Z" fill="#ffd6ee"/>` +
      `<path d="M44 26 L32 31 L32 61 L44 48 Z" fill="#ff8fcf"/>` +
      `<path d="M20 26 L32 31 L32 61 L20 48 Z" fill="#d9579f"/>` +
      `<path d="M24 34 L26 44" fill="none" stroke="#ffd6ee" stroke-width="1.6"/>` +
      `<polygon points="${burst(53, 20, 4, 6, 1.8)}" fill="#fff1b8" stroke="none"/><polygon points="${burst(11, 38, 4, 5, 1.6)}" fill="#fff1b8" stroke="none"/>`,
  ),
  // Ice Queen Wand: a frost-blue wand with a snowflake for a head (it slows, and drinks from spells).
  icequeenwand: svg(
    line('M14 59 L33 33', '#5c8fc0', 4) +
      [0, 60, 120, 180, 240, 300]
        .map((deg) => {
          const a = (deg * Math.PI) / 180;
          const p = (r: number, off = 0) => {
            const b = a + off;
            return `${(42 + r * Math.sin(b)).toFixed(1)} ${(22 - r * Math.cos(b)).toFixed(1)}`;
          };
          const tip = p(13);
          const mid = p(8);
          return line(`M42 22 L${tip} M${mid} L${p(11.5, 0.45)} M${mid} L${p(11.5, -0.45)}`, '#dff6ff', 2.2);
        })
        .join('') +
      `<circle cx="42" cy="22" r="3.6" fill="#7fd8ff"/>`,
  ),
  // --- Hybrid equipment ---
  // Purple Buff: a violet essence orb, swirling, motes drifting round it (mana after each skill).
  purplebuff: svg(
    `<circle cx="32" cy="34" r="20" fill="#7b3fd1"/>` +
      `<path d="M32 14 C43 14 52 23 52 34 C52 45 43 54 32 54 C40 50 45 43 45 34 C45 25 40 18 32 14 Z" fill="#5a2aa6" stroke="none"/>` +
      `<path d="M23 31 C25 22 38 20 42 28 C45 34 40 40 34 38 C30 37 30 32 34 31" fill="none" stroke="#e9dcff" stroke-width="2.6"/>` +
      `<circle cx="25" cy="25" r="3.5" fill="#f1e8ff" stroke="none"/>` +
      [[53, 13, 2.6], [9, 49, 2.2], [55, 50, 1.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 0.6}" fill="#d9c2ff" stroke="none"/>`).join(''),
  ),
  // Sheep Stick: a fluffy sheep, and the witch's star wand that made it.
  sheepstick: svg(
    line('M42 59 L53 16', '#6e3fa0', 3.5) +
      `<polygon points="${burst(54, 11, 5, 8, 3.4)}" fill="${GOLD}"/>` +
      line('M21 47 L21 57 M31 47 L31 57', '#2e2a33', 3) +
      [[19, 34, 8], [27, 28, 9], [36, 33, 8], [31, 42, 8], [21, 43, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke-width="4"/>`).join('') +
      [[19, 34, 8], [27, 28, 9], [36, 33, 8], [31, 42, 8], [21, 43, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#f4f1ea" stroke="none"/>`).join('') +
      `<path d="M7 33 C7 27 17 27 17 33 L16 42 C15 46 9 46 8 42 Z" fill="#2e2a33"/>` +
      `<path d="M7 33 L3 35 L7 37 Z M17 33 L20 35 L16.5 37 Z" fill="#2e2a33"/>` +
      `<circle cx="10" cy="35" r="1.3" fill="#fff" stroke="none"/><circle cx="14" cy="35" r="1.3" fill="#fff" stroke="none"/>`,
  ),
  // Spellblade Talisman: a paper talisman with a sword sigil, a blue bolt crackling off it (it starts each fight
  // with mana).
  spellbladetalisman: svg(
    line('M26 9 L26 3', '#c8243a', 2) +
      `<path d="M14 9 L38 9 L38 58 L14 58 Z" fill="#f3e3b0"/>` +
      `<path d="M26 15 L26 41 M20 37 L32 37" fill="none" stroke="#c8243a" stroke-width="2.6"/>` +
      `<circle cx="26" cy="46" r="2.4" fill="#c8243a" stroke="none"/>` +
      `<path d="M18 52 L34 52" fill="none" stroke="#c8243a" stroke-width="1.6"/>` +
      `<path d="M50 14 L41 32 L47.5 32 L41 52 L57 27 L50 27 L55 14 Z" fill="#5fc4e8"/>`,
  ),
  // Thief Tool: a brass key ring, a key and two lockpicks hanging off it (it copies equipment for the fight).
  thieftool: svg(
    line('M14 22 C14 16.5 18.5 12 24 12 C29.5 12 34 16.5 34 22 C34 27.5 29.5 32 24 32 C18.5 32 14 27.5 14 22 Z', GOLD, 3) +
      line('M20 31 L13 55 L17.5 57.5', '#c3cad6', 2.5) +
      line('M26 32 L28 56', '#c3cad6', 2.5) +
      `<path d="M28 55 L30.5 58.5 L28 62 L25.5 58.5 Z" fill="#c3cad6"/>` +
      line('M38 38 L55 55', GOLD, 3.5) +
      line('M49 49 L45 53 M53 53 L49 57', GOLD, 3) +
      `<circle cx="34" cy="34" r="6.5" fill="${GOLD}"/><circle cx="34" cy="34" r="2.4" fill="#3a2a22"/>`,
  ),
  // Winter Crown: a crown of ice spikes on a frost band, a blue gem set in it (it freezes its wearer safe).
  wintercrown: svg(
    `<path d="M12 45 L13 21 L22 34 L26 10 L32 29 L38 10 L42 34 L51 21 L52 45 Z" fill="#cfefff"/>` +
      `<path d="M26 10 L32 29 L29 31 Z M38 10 L42 34 L39 33 Z M13 21 L22 34 L18 35 Z M51 21 L52 45 L49 40 Z" fill="#9fd6f2" stroke="none"/>` +
      `<path d="M11 44 L53 44 L51 55 L13 55 Z" fill="#8fcff0"/>` +
      `<circle cx="32" cy="49.5" r="3.6" fill="#2f8fd6"/><circle cx="20" cy="49.5" r="2" fill="#2f8fd6"/><circle cx="44" cy="49.5" r="2" fill="#2f8fd6"/>` +
      `<polygon points="${burst(56, 10, 4, 5, 1.6)}" fill="#ffffff" stroke="none"/><polygon points="${burst(8, 30, 4, 4, 1.4)}" fill="#ffffff" stroke="none"/>`,
  ),
  // --- Armor equipment ---
  // Ancient Wrath: a red oni mask, horned and fanged, glaring (it taunts the enemies in front of it).
  ancientwrath: svg(
    `<path d="M19 18 C12 13 9 7 11 2 C16 6 20 10 25 14 Z" fill="#efe3c4"/><path d="M45 18 C52 13 55 7 53 2 C48 6 44 10 39 14 Z" fill="#efe3c4"/>` +
      `<path d="M16 21 C16 12 48 12 48 21 L50 36 C50 50 42 58 32 58 C22 58 14 50 14 36 Z" fill="#c8243a"/>` +
      `<path d="M32 13 C42 13 48 15 48 21 L50 36 C50 50 42 58 32 58 Z" fill="#a01a2e" stroke="none"/>` +
      `<path d="M17 25 L29 29.5 L28 33 L17 29 Z" fill="#3a1018"/><path d="M47 25 L35 29.5 L36 33 L47 29 Z" fill="#3a1018"/>` +
      `<path d="M20 31 L28 34 L26.5 37.5 L20 35 Z" fill="#ffd45a"/><path d="M44 31 L36 34 L37.5 37.5 L44 35 Z" fill="#ffd45a"/>` +
      `<path d="M29.5 38 L34.5 38 L33 42 L31 42 Z" fill="#7a1622"/>` +
      `<path d="M19 45 C26 49 38 49 45 45 C43 53 21 53 19 45 Z" fill="#3a1018"/>` +
      `<path d="M23 46 L25 52 L27.5 47 Z M41 46 L39 52 L36.5 47 Z" fill="#ffffff"/>`,
  ),
  // Antique Cuirass: a sculpted bronze breastplate, green with age at the hem (damage reduction; it saps
  // whoever hits it).
  antiquecuirass: svg(
    `<path d="M16 12 C22 10 26 14 32 14 C38 14 42 10 48 12 L53 22 C49 26 47 32 48 40 L46 54 C40 58 24 58 18 54 L16 40 C17 32 15 26 11 22 Z" fill="#c98a45"/>` +
      `<path d="M32 14 C38 14 42 10 48 12 L53 22 C49 26 47 32 48 40 L46 54 C42 57 37 57.5 32 57.5 Z" fill="#a86b32" stroke="none"/>` +
      `<path d="M21 24 C25 31 30 31 32 26 C34 31 39 31 43 24 M32 31 L32 50 M24 39 C28 41 36 41 40 39 M25 46 C28 48 36 48 39 46" fill="none" stroke="#6e4a20" stroke-width="1.6"/>` +
      `<path d="M18 52 C24 56 40 56 46 52" fill="none" stroke="#5fb3a0" stroke-width="2.4"/>` +
      `<path d="M16 13.5 C21 12 25 15.5 29 15.8 M48 13.5 C43 12 39 15.5 35 15.8" fill="none" stroke="#5fb3a0" stroke-width="2"/>`,
  ),
  // Blade Armor: a dark iron breastplate ringed with blades (it hits back at whoever hits it).
  bladearmor: svg(
    `<polygon points="${burst(32, 34, 12, 30, 19)}" fill="#a3acbb"/>` +
      `<path d="M18 16 C24 14 28 18 32 18 C36 18 40 14 46 16 L48 30 L46 50 C40 54 24 54 18 50 L16 30 Z" fill="#4a5262"/>` +
      `<path d="M32 18 C36 18 40 14 46 16 L48 30 L46 50 C42 52.5 37 53.5 32 53.5 Z" fill="#3a4150" stroke="none"/>` +
      `<path d="M32 20 L32 51 M21 30 C26 34 38 34 43 30" fill="none" stroke="#7c8696" stroke-width="1.6"/>` +
      `<circle cx="22" cy="22" r="1.6" fill="#c3cad6" stroke="none"/><circle cx="42" cy="22" r="1.6" fill="#c3cad6" stroke="none"/>`,
  ),
  // Dominance Ice: glacier crystals rising from a pool of frost (it chills the attack speed of enemies near it).
  dominanceice: svg(
    `<path d="M7 54 C7 47 57 47 57 54 C57 61 7 61 7 54 Z" fill="#2f6fae"/>` +
      `<path d="M18 18 L24 26 L24 53 L14 53 L12 28 Z" fill="#8fd0f5"/>` +
      `<path d="M47 22 L53 30 L51 53 L41 53 L40 30 Z" fill="#8fd0f5"/>` +
      `<path d="M32 4 L40 16 L38 52 L26 52 L24 16 Z" fill="#d6f0ff"/>` +
      `<path d="M32 4 L40 16 L38 52 L32 52 Z" fill="#9fd6f2" stroke="none"/>` +
      `<path d="M28 18 L28.5 40" fill="none" stroke="#ffffff" stroke-width="1.6"/>`,
  ),
  // Guardian Helmet: a silver great helm with a green plume and a green cross (it heals every second).
  guardianhelmet: svg(
    `<path d="M31 13 C33 3 47 0 57 6 C50 9 44 12 39 18 Z" fill="#4fbf6a"/>` +
      `<path d="M16 24 C16 14 24 10 32 10 C40 10 48 14 48 24 L48 52 C42 56 22 56 16 52 Z" fill="#d8dee8"/>` +
      `<path d="M32 10 C40 10 48 14 48 24 L48 52 C44 54.5 38 55.5 32 55.5 Z" fill="#b3bccb" stroke="none"/>` +
      `<path d="M32 11 L32 29" fill="none" stroke="${GOLD}" stroke-width="2"/>` +
      `<path d="M18 29 L46 29 L46 34 L18 34 Z" fill="#2a2e38"/>` +
      `<path d="M30 38 L34 38 L34 42 L38 42 L38 46 L34 46 L34 50 L30 50 L30 46 L26 46 L26 42 L30 42 Z" fill="#5fd47a"/>`,
  ),
  // Oracle: a blue evil-eye talisman in a gold frame (it wards off what the enemy throws at it).
  oracle: svg(
    `<path d="M4 32 C16 13 48 13 60 32 C48 51 16 51 4 32 Z" fill="${GOLD}"/>` +
      `<path d="M10 32 C20 19 44 19 54 32 C44 45 20 45 10 32 Z" fill="#f4f1ea"/>` +
      `<circle cx="32" cy="32" r="11" fill="#2f6fd6"/><circle cx="32" cy="32" r="7.5" fill="#8fd0ff" stroke="none"/>` +
      `<circle cx="32" cy="32" r="4.2" fill="#14161c"/><circle cx="29.5" cy="29.5" r="1.8" fill="#ffffff" stroke="none"/>` +
      line('M32 6 L32 10 M18 9 L20 13 M46 9 L44 13 M32 54 L32 58', '#ffe27a', 1.8),
  ),
  // Thunder Belt: a leather belt, its gold buckle bearing a lightning bolt, sparks crackling off (it calls down
  // thunder every few seconds).
  thunderbelt: svg(
    `<path d="M4 26 C20 29 44 29 60 26 L60 38 C44 41 20 41 4 38 Z" fill="#6b4426"/>` +
      `<path d="M6 29 C20 32 44 32 58 29 M6 35 C20 38 44 38 58 35" fill="none" stroke="#8a5a32" stroke-width="1.2"/>` +
      `<path d="M22 19 L42 19 L42 47 L22 47 Z" fill="${GOLD}"/>` +
      `<path d="M26 23 L38 23 L38 43 L26 43 Z" fill="#3a2a22"/>` +
      `<path d="M36 23.5 L27 35 L32 35 L28 43.5 L38.5 30.5 L33.5 30.5 L37.5 23.5 Z" fill="#ffe27a" stroke="none"/>` +
      line('M49 8 L52 13 L48.5 14 L52 20', '#ffe27a', 1.8) +
      line('M15 44 L12 49 L15.5 50 L12 56', '#ffe27a', 1.8),
  ),
  // --- Commander items ---
  // Ice Longbow (Miya's): a recurve bow of ice, its string drawn on a frost-tipped arrow. Tilted.
  icelongbow: svg(
    line(tilt('M22 7 C19 7 18 9 20 11 C34 21 34 43 20 53 C18 55 19 57 22 57', 25), '#9fdcff', 4) +
      line(tilt('M20.5 10 L20.5 54', 25), '#eef8ff', 1.2) +
      line(tilt('M25 28 L25 36', 25), '#2f5f9e', 4.5) +
      line(tilt('M14 32 L46 32', 25), '#eef8ff', 2) +
      `<path d="${tilt('M44 27.5 L54 32 L44 36.5 L47 32 Z', 25)}" fill="#bfeaff"/>` +
      `<path d="${tilt('M11 28 L17 32 L11 36 L14 32 Z', 25)}" fill="#5fa8e0"/>`,
  ),
  // Essence Core (Luo Yi's): an amber core, faceted, with a light orb and a dark one orbiting it: her duality.
  essencecore: svg(
    line('M7 38 C7 28 57 22 57 30 C57 40 7 46 7 38 Z', '#c99a4a', 1.6) +
      `<path d="M32 8 L46 30 L32 54 L18 30 Z" fill="#ffb347"/>` +
      `<path d="M32 8 L46 30 L32 54 Z" fill="#e8892a" stroke="none"/>` +
      `<path d="M18 30 L32 26 L46 30 M32 8 L32 26" fill="none" stroke="#ffd98a" stroke-width="1.4"/>` +
      `<circle cx="12" cy="42" r="5" fill="#f4f1ea"/><circle cx="53" cy="23" r="5" fill="#1d1622"/>` +
      `<circle cx="53" cy="23" r="1.6" fill="#f4f1ea" stroke="none"/><circle cx="12" cy="42" r="1.6" fill="#1d1622" stroke="none"/>`,
  ),
  // Great Dragon Spear: a steel spear point over a gold dragon's head, a red tassel at its throat, a dark red
  // shaft. Tilted.
  greatdragonspear: svg(
    line(tilt('M32 25 L32 63', 40), '#7a1622', 3.5) +
      `<path d="${tilt('M32 1 C35.5 8 36 15 34.5 21 L29.5 21 C28 15 28.5 8 32 1 Z', 40)}" fill="#dfe6f0"/>` +
      `<path d="${tilt('M32 1 C35.5 8 36 15 34.5 21 L32 21 Z', 40)}" fill="#b9c6d8" stroke="none"/>` +
      `<path d="${tilt('M29 27 C24 29 22 34 24 40 C26 36 29 34 31.5 33 Z', 40)}" fill="#c8243a"/>` +
      `<path d="${tilt('M27.5 21 L36.5 21 L35.5 26.5 L28.5 26.5 Z', 40)}" fill="${GOLD}"/>` +
      line(tilt('M32 29 C40 32 40 36 32 38 C24 40 24 44 32 46 C40 48 40 52 32 54', 40), '#e3b341', 3) +
      `<path d="${tilt('M33 26 C38 25 42 27 41 31 C39 31 37 30.5 34 30 Z', 40)}" fill="#e3b341"/>` +
      `<circle ${at(38, 28, 40)} r="1.2" fill="#c8243a" stroke="none"/>`,
  ),
  // Plunderer's Claw: an iron grappling hook on a rope, a gold coin snagged on a prong (it hooks an enemy and
  // takes its gold).
  plundererclaw: svg(
    line('M32 9 C24 4 16 6 12 12 C9 17 12 22 8 27', '#c9a36a', 2.6) +
      `<circle cx="32" cy="10" r="4.5" fill="none" stroke="${OUTLINE}" stroke-width="5"/><circle cx="32" cy="10" r="4.5" fill="none" stroke="#7c8696" stroke-width="2.5"/>` +
      line('M32 15 L32 46', '#7c8696', 4.5) +
      line('M32 46 C22 46 14 40 12 30', '#7c8696', 4) +
      line('M32 46 C42 46 50 40 52 30', '#7c8696', 4) +
      line('M32 46 L32 58', '#7c8696', 4) +
      `<path d="M9 33 L12 26 L15.5 32 Z M55 33 L52 26 L48.5 32 Z M28.5 56 L32 62 L35.5 56 Z" fill="#a3acbb"/>` +
      line('M25 24 L39 24', '#7c8696', 3.5) +
      `<circle cx="51" cy="44" r="6.5" fill="${GOLD}"/><circle cx="51" cy="44" r="3.8" fill="none" stroke="#a87a1e" stroke-width="1.4"/>`,
  ),
  // Supreme Blade (Katarina's): her crimson-and-silver blade made grand. A long sword on the diagonal, a gold
  // winged guard with a blood gem, a glint at the tip.
  supremeblade: svg(
    `<path d="${tilt('M32 2 L37 10 L37 42 L27 42 L27 10 Z')}" fill="#e4ecf6"/>` +
      `<path d="${tilt('M32 2 L37 10 L37 42 L32 42 Z')}" fill="#b9c6d8"/>` +
      `<path d="${tilt('M32 9 L32 40')}" fill="none" stroke="#b8243a" stroke-width="2.5"/>` +
      `<path d="${tilt('M17 40 C21 40 26 41 32 43 C38 41 43 40 47 40 L44 46 C40 46 36 47 32 48 C28 47 24 46 20 46 Z')}" fill="#e3b341"/>` +
      `<circle ${at(32, 44)} r="3.6" fill="#b8243a"/>` +
      `<path d="${tilt('M29.5 47 L34.5 47 L34.5 57 L29.5 57 Z')}" fill="#3a1a22"/>` +
      `<path d="${tilt('M28 59 L32 56 L36 59 L32 62 Z')}" fill="#e3b341"/>` +
      `<path d="M51 5l1.5 4.5L57 11l-4.5 1.5L51 17l-1.5-4.5L45 11l4.5-1.5z" fill="#fff3c4"/>`,
  ),
  // Gustiwana's items. Keris: the wavy Javanese dagger, its blade snaking to the point, a flared base (ganja),
  // a gold ring and a curved teak hilt.
  keris: svg(
    `<path d="${tilt(kerisBlade(), 35)}" fill="#c9ced8"/>` +
      `<path d="${tilt('M33 6 L33.6 40', 35)}" fill="none" stroke="#8e96a6" stroke-width="1.2"/>` +
      `<path d="${tilt('M21 44 C25 42 35 41 44 40.5 L43 46 C36 46.5 28 47 23 47.5 Z', 35)}" fill="${GOLD}"/>` +
      `<circle ${at(32.5, 49.5, 35)} r="2.6" fill="${GOLD}"/>` +
      `<path d="${tilt('M30 51 C29.5 55 30.5 59 33.5 61.5 C36.5 62 38 59 36 56.5 C35 54 35 52.5 35 51 Z', 35)}" fill="${TEAK}"/>`,
  ),
  // Blangkon: the Javanese batik head wrap, seen from the side. A dark dome striped with parang (the diagonal
  // batik wave), a maroon band, and the knot bulging at the back (mondolan) with its two little tails.
  blangkon: svg(
    `<path d="M49 29 L59 20 L58 31 Z" fill="${MAROON}"/>` +
      `<path d="M50 30 L61 27 L56 35 Z" fill="${MAROON}"/>` +
      `<circle cx="50" cy="37" r="8.5" fill="#3d2418"/>` +
      `<path d="M46 33 C49 34 51 37 50 41" fill="none" stroke="${GOLD}" stroke-width="1.6"/>` +
      `<path d="M11 44 C11 26 19 17 30 17 C41 17 48 26 48 44 Z" fill="#5a3320"/>` +
      [15, 22, 29, 36]
        .map((x) => `<path d="M${x} 42 C${x + 5} 39 ${x + 1} 33 ${x + 8} ${x === 15 ? 30 : 27}" fill="none" stroke="${GOLD}" stroke-width="2"/>`)
        .join('') +
      `<path d="M8 41 L52 41 L52 47 C38 51 22 51 8 47 Z" fill="${MAROON}"/>` +
      `<path d="M10 44.5 C22 47.5 38 47.5 50 44.5" fill="none" stroke="${ROSE}" stroke-width="1.5"/>`,
  ),
  // Pyre Offering (Cult of Fire's): a bronze brazier on three legs, a gold gem given to its flame, burning in the
  // cult's colours (its badge: magenta, a pale lavender heart). Embers rise off it.
  offering: svg(
    `<path d="M32 4 C36 11 46 15 46 28 C46 34 43 38 39 40 L25 40 C21 38 18 34 18 28 C18 22 21 19 23 15 C25 19 26 21 28 22 C27 15 29 9 32 4 Z" fill="#c2338f"/>` +
      `<path d="M32 15 C35 20 40 23 40 30 C40 34 37 38 32 38 C27 38 24 34 24 30 C24 27 26 25 27 23 C28 26 29 27 30 27 C30 22 31 19 32 15 Z" fill="#e5dbfd" stroke="none"/>` +
      `<path d="M32 26 L36 31 L32 36 L28 31 Z" fill="${GOLD}"/>` +
      `<circle cx="48" cy="10" r="1.8" fill="#f59ad0" stroke="none"/><circle cx="15" cy="14" r="1.4" fill="#f59ad0" stroke="none"/><circle cx="51" cy="20" r="1.2" fill="#e5dbfd" stroke="none"/>` +
      `<path d="M22 52 L17 61 M42 52 L47 61 M32 53 L32 61" fill="none" stroke="#6e4a25" stroke-width="3"/>` +
      `<path d="M12 38 L52 38 C51 47 43 54 32 54 C21 54 13 47 12 38 Z" fill="#a86b32"/>` +
      `<path d="M10 36 L54 36 L54 40 L10 40 Z" fill="#c98a45"/>` +
      `<path d="M18 45 C26 48 38 48 46 45" fill="none" stroke="#e0a95e" stroke-width="1.5"/>`,
  ),
  // Black Sash (Kenzo's): a black belt, front on. The knot at the middle, its two tails hanging, each tail with
  // the gold stripes of a high rank.
  // Black on a dark slot would vanish, so the sash has a pale rim of its own (the board's own dark outline
  // around it stays from svg()).
  blacksash: svg(
    `<g stroke="#8c8ca3">` +
      `<path d="M4 22 C20 26 44 26 60 22 L60 32 C44 36 20 36 4 32 Z" fill="#0f0f14"/>` +
      `<path d="M29 31 L20 58 L28 60.5 L34 33 Z" fill="#0f0f14"/>` +
      `<path d="M35 31 L46 57 L38 60.5 L30 33 Z" fill="#17171e"/>` +
      `<path d="M25 18 C30 16.5 34 16.5 39 18 L41 35 C35 37 29 37 23 35 Z" fill="#1a1a22"/></g>` +
      `<path d="M7 25.5 C20 29 44 29 57 25.5" fill="none" stroke="#3e3e4e" stroke-width="1.6"/>` +
      `<path d="M26 20 L39 33" fill="none" stroke="#4a4a5c" stroke-width="2.2"/>` +
      `<path d="M22.6 50.5 L28.6 52.2 M21.5 54.5 L27.7 56.2 M40.8 50.2 L44.6 48.6 M42.4 53.9 L46 52.3" fill="none" stroke="${GOLD}" stroke-width="2.2"/>`,
  ),
  // Ruby's two, both red (she's Little Red Riding Hood). The Cloak: a red hooded cape, dark inside the hood,
  // a gold clasp at the neck, its folds flaring out.
  redcloak: svg(
    `<path d="M32 4 C44 4 50 14 49 26 C55 36 59 48 60 60 L4 60 C5 48 9 36 15 26 C14 14 20 4 32 4 Z" fill="#c8243a"/>` +
      `<path d="M32 10 C40 10 44 17 43 26 C40 29 36 31 32 31 C28 31 24 29 21 26 C20 17 24 10 32 10 Z" fill="#3a1018"/>` +
      `<path d="M22 34 L16 60 M42 34 L48 60 M32 36 L32 60" fill="none" stroke="#8e1628" stroke-width="2"/>` +
      `<path d="M15 26 C11 38 8 48 4 60" fill="none" stroke="#e85a6a" stroke-width="1.5"/>` +
      `<circle cx="32" cy="33" r="3.5" fill="${GOLD}"/>`,
  ),
  // The Scythe: a reaper's scythe in Ruby's red. A long shaft on the diagonal with a grip jutting from it, and
  // the great crescent blade sweeping off its top, a bright edge along the cut.
  scythe: svg(
    `<path d="M13 60 L48 6" fill="none" stroke="${OUTLINE}" stroke-width="7"/><path d="M13 60 L48 6" fill="none" stroke="#7a1622" stroke-width="4"/>` +
      `<path d="M27 39 L19 33" fill="none" stroke="${OUTLINE}" stroke-width="6"/><path d="M27 39 L19 33" fill="none" stroke="#5a1018" stroke-width="3"/>` +
      `<path d="M47 6 C36 1 18 4 5 21 C18 13 32 11 44 15 Z" fill="#d6283a"/>` +
      `<path d="M44.5 7 C34 4 19 7 8 18.5" fill="none" stroke="#ff9aa2" stroke-width="1.6"/>` +
      `<circle cx="46.5" cy="9" r="3" fill="#3a1018"/>`,
  ),
  // Jimat: a Javanese charm on a string of teak beads, a gold medallion bearing Gustiwana's tree.
  jimat: svg(
    [[16.5, 5], [19.5, 9.7], [22.5, 14.4], [25.5, 19], [28.5, 23.7]]
      .flatMap(([x, y]) => [`<circle cx="${x}" cy="${y}" r="2.7" fill="${TEAK}"/>`, `<circle cx="${64 - x}" cy="${y}" r="2.7" fill="${TEAK}"/>`])
      .join('') +
      `<circle cx="32" cy="26.5" r="3" fill="${GOLD}"/>` +
      `<circle cx="32" cy="43" r="17" fill="${GOLD}"/><circle cx="32" cy="43" r="13" fill="${MAROON}"/>` +
      `<path d="M32 32.5 L38 40.5 H35 L40 47.5 H34 V53 H30 V47.5 H24 L29 40.5 H26 Z" fill="${ROSE}" stroke="none"/>`,
  ),
};

// Pacquiao's boxing gloves (gloves.ts; not items, so not in ITEM_SVGS): one glove, side on, laced at a white
// cuff, in the colour of the hero cost it's for. The Glory Glove: white and gold in a laurel wreath, a star on
// its cuff (any cost up to 3).
const glove = (body: string, dark: string, light: string, cuff = '#f4f1ea', extra = '') =>
  svg(
    extra +
      `<path d="M21 43 L50 43 L48.5 59 L22.5 59 Z" fill="${cuff}"/>` +
      `<path d="M27 46.5 L43 55.5 M43 46.5 L27 55.5" fill="none" stroke="#8a8f9c" stroke-width="1.3"/>` +
      `<path d="M19 35 C15 21 21 6 35 6 C48 6 55 16 53 30 L51 44 L21 44 Z" fill="${body}"/>` +
      `<path d="M53 30 L51 44 L36 44 C44 41 50 36 53 30 Z" fill="${dark}" stroke="none"/>` +
      `<path d="M23 31 C31 35.5 43 35.5 52 29" fill="none" stroke="${dark}" stroke-width="2"/>` +
      `<path d="M22 42 C13 42 8 34 10.5 26.5 C12.5 21 18.5 20.5 21 25 L24 33 C25 37 24.5 40 22 42 Z" fill="${dark}"/>` +
      `<path d="M26 14 C31 9.5 41 9 47 14" fill="none" stroke="${light}" stroke-width="2.6"/>`,
  );

export const GLOVE_SVGS: Record<string, string> = {
  glove3: glove('#3a84d6', '#2a62a6', '#9fcbff'),
  glove4: glove('#a457d6', '#7c3aa8', '#dbb4f5'),
  glove5: glove('#e0a63a', '#b07a1e', '#ffe3a0'),
  glory: glove(
    '#f4f1ea',
    '#d9cfae',
    '#ffffff',
    GOLD,
    line('M9 52 C3 42 3 24 12 13', '#3fae5a', 2.4) +
      line('M55 52 C61 42 61 24 52 13', '#3fae5a', 2.4) +
      [[6, 40], [5.5, 30], [8, 21], [58, 40], [58.5, 30], [56, 21]]
        .map(([x, y]) => `<path d="M${x} ${y - 3.5} C${x + 3} ${y - 1} ${x + 3} ${y + 1.5} ${x} ${y + 3.5} C${x - 3} ${y + 1.5} ${x - 3} ${y - 1} ${x} ${y - 3.5} Z" fill="#5fd47a"/>`)
        .join(''),
  ).replace('</g></svg>', `<polygon points="${burst(35.5, 51, 5, 4.5, 1.9)}" fill="#ffffff"/></g></svg>`),
};
