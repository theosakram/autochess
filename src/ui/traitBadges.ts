import { TRAITS } from '../game/traits';

// What a trait looks like: a round badge in the trait's colour with a icon on it (white unless the trait says otherwise). HTML and the
// board draw the same thing from this table. Icons are on a 24x24 grid. `d` is the icon; `cut`, drawn
// over it in the badge's colour, makes the holes (eyes, a spine), since both renderers paint those alike.
export interface TraitBadge {
  color: number;
  ink?: number; // the icon's colour; white if not set
  d: string;
  cut?: string;
}

const EYES = 'M9 8L11 11L9 14L7 11Z M15 8L17 11L15 14L13 11Z';

export const TRAIT_BADGES: Record<string, TraitBadge> = {
  // Factions
  astral: { color: 0x5d6ea6, ink: 0x211f63, d: 'M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5Z' },
  cultoffire: { color: 0x8a1871, ink: 0xe5dbfd, d: 'M12 2C13 7 19 9 19 15C19 19 16 22 12 22C8 22 5 19 5 15C5 12 7 10 8.5 8C9 10 10 11 11.5 11C12.5 8 11 5 12 2Z' },
  dragonaltar: { color: 0x640c69, ink: 0xf2beff, d: 'M6 3C8 9 8 15 5 21C10 16 11 9 6 3Z M12 2C14 9 14 15 11 22C16 16 17 8 12 2Z M18 3C20 9 20 15 17 21C22 16 23 9 18 3Z' },
  gustiwana: { color: 0x5c1629, ink: 0xd49198, d: 'M12 2L18 10H15L20 17H14V22H10V17H4L9 10H6Z' },
  mistbender: {
    color: 0x50560e,
    ink: 0xf1e798,
    d: 'M2 5C5 2 8 2 12 5C16 8 19 8 22 5V8.5C19 11.5 16 11.5 12 8.5C8 5.5 5 5.5 2 8.5Z M2 11.5C5 8.5 8 8.5 12 11.5C16 14.5 19 14.5 22 11.5V15C19 18 16 18 12 15C8 12 5 12 2 15Z M2 18C5 15 8 15 12 18C16 21 19 21 22 18V21.5C19 24.5 16 24.5 12 21.5C8 18.5 5 18.5 2 21.5Z',
  },
  mooneater: { color: 0x443b49, ink: 0xa598b4, d: 'M15 2C9 2 4 6.5 4 12C4 17.5 9 22 15 22C17 22 18.5 21.5 20 20.8C15 20 11 16.5 11 12C11 7.5 15 4 20 3.2C18.5 2.5 17 2 15 2Z' },
  necromancer: { color: 0x085d6c, ink: 0xb9fffe, d: 'M12 2C7 2 4 6 4 10.5C4 13.5 5.5 15.5 8 16.5V21H16V16.5C18.5 15.5 20 13.5 20 10.5C20 6 17 2 12 2Z', cut: `${EYES} M11 16H13V21H11Z` },
  skybringer: { color: 0x7e6801, ink: 0xfafc9f, d: 'M14 1L5 13H11L9 23L19 10H13Z' },
  spectre: { color: 0x21146f, ink: 0x89eaff, d: 'M12 2C7 2 4 6 4 11V22L7 19.5L9.5 22L12 19.5L14.5 22L17 19.5L20 22V11C20 6 17 2 12 2Z', cut: EYES },
  storyweaver: { color: 0x562866, ink: 0xc5d8ff, d: 'M12 6C9 4 6 4 2 5V20C6 19 9 19 12 21C15 19 18 19 22 20V5C18 4 15 4 12 6Z', cut: 'M11.4 6.5H12.6V20H11.4Z' },
  // Roles
  dauntless: { color: 0x5d1e10, ink: 0xffa58a, d: 'M12 2L21 9V14L12 7L3 14V9Z M12 10L21 17V22L12 15L3 22V17Z' },
  deadeye: { color: 0x0b2f69, ink: 0x6ae7bf, d: 'M10.75 2H13.25V8H10.75Z M10.75 16H13.25V22H10.75Z M2 10.75H8V13.25H2Z M16 10.75H22V13.25H16Z M12 9L15 12L12 15L9 12Z' },
  defender: { color: 0x3f1f09, ink: 0xf7b27d, d: 'M12 2L20 5V12C20 17 16 20.5 12 22C8 20.5 4 17 4 12V5Z' },
  fighter: { color: 0x3d2d15, ink: 0xfccc92, d: 'M7 4C7 3 8 2 9 2H16C19 2 21 5 21 8V13C21 15 20 16 18 17V22H8V17L4 13C3 12 3 10 4 9L7 11Z' },
  hunter: { color: 0x4c2165, ink: 0xd2a6ea, d: 'M21 3L13.5 4.5L15.8 6.8L3 19.5L4.5 21L17.2 8.2L19.5 10.5Z M3 4H5C5 9 7 11 11 12L9.5 13.5C5.5 12.5 3.5 9.5 3 4Z' },
  mage: { color: 0x0c284e, ink: 0x4497f5, d: 'M12 2L17 14H7Z M3 15H21L22 18H2Z' },
  phasewarper: { color: 0x1b5d53, ink: 0xd5f7f9, d: 'M3 6H14V3L20 7.5L14 12V9H3Z M21 15H10V12L4 16.5L10 21V18H21Z' },
  scavenger: { color: 0x633a0b, ink: 0xfdf3c6, d: 'M12 11C8 11 6 15 6 18C6 20 8 21 12 21C16 21 18 20 18 18C18 15 16 11 12 11Z M5 8C3 8 3 13 5.5 13C7.5 13 7 8 5 8Z M10 3C8 3 8 9 10 9C12 9 12 3 10 3Z M15 3C13 3 13 9 15 9C17 9 17 3 15 3Z M19.5 8C17.5 8 17 13 19 13C21 13 21.5 8 19.5 8Z' },
  stargazer: { color: 0x271a58, ink: 0xbc98ff, d: 'M12 2L15 9H22L16.5 13.5L18.5 21L12 16.5L5.5 21L7.5 13.5L2 9H9Z' },
  weaponmaster: { color: 0x552a2a, ink: 0xf06b6e, d: 'M3 3H7L21 17L17 21L3 7Z M21 3H17L3 17L7 21L21 7Z' },
};

// Bearers get a trait's bonus without being members, so they must not look like members. By the
// trait they carry: Plane Wanderers (Necromancer) and the Pyre Offering's bearer (Cult of Fire).
export const BEARER_BADGES: Record<string, TraitBadge> = {
  necromancer: {
    color: 0x3a3f4f,
    ink: 0xe8e2c8,
    d: 'M12 3C17 3 21 7 21 12C21 17 17 21 12 21C7 21 3 17 3 12C3 7 7 3 12 3Z',
    cut: 'M17 7L13.5 13.5L7 17L10.5 10.5Z',
  },
  cultoffire: { color: 0x6b3a00, ink: 0xffc46b, d: 'M6 3H18C18 9 16 12 13.5 13V18H17V21H7V18H10.5V13C8 12 6 9 6 3Z' },
};

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export const paths = (d: string) => d.split(/(?=M)/).map((s) => s.trim());

// Icons use absolute M/L/H/V/C/Z only. Tokens: a command letter, or a number.
const tokens = (d: string) => d.match(/[MLHVCZ]|-?\d*\.?\d+/g) ?? [];

// The icon's true bounds on the 24x24 grid (curves sampled, not just their control points).
export function iconBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  let cmd = 'M';
  let x = 0;
  let y = 0;
  const t = tokens(d);
  for (let i = 0; i < t.length; ) {
    if (/[A-Z]/.test(t[i])) cmd = t[i++];
    if (cmd === 'Z') continue;
    const n = () => Number(t[i++]);
    if (cmd === 'H') x = n();
    else if (cmd === 'V') y = n();
    else if (cmd === 'C') {
      const [x1, y1, x2, y2, x3, y3] = [n(), n(), n(), n(), n(), n()];
      for (let k = 1; k <= 16; k++) {
        const s = k / 16;
        const u = 1 - s;
        xs.push(u * u * u * x + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * x3);
        ys.push(u * u * u * y + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s * y3);
      }
      [x, y] = [x3, y3];
    } else [x, y] = [n(), n()];
    xs.push(x);
    ys.push(y);
  }
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

// The same path moved by (dx, dy).
export function shiftPath(d: string, dx: number, dy: number): string {
  if (!dx && !dy) return d;
  const r = (v: number) => String(Math.round(v * 100) / 100);
  const out: string[] = [];
  let cmd = 'M';
  let k = 0; // which number of the command's argument list
  for (const tok of tokens(d)) {
    if (/[A-Z]/.test(tok)) {
      cmd = tok;
      k = 0;
      out.push(tok);
      continue;
    }
    const v = Number(tok);
    const isX = cmd === 'H' || (cmd !== 'V' && k % 2 === 0);
    out.push(r(v + (isX ? dx : dy)));
    k++;
  }
  return out.join(' ');
}

// The shift that puts an icon's middle on the badge's middle (12,12).
export function centering(d: string): { dx: number; dy: number } {
  const b = iconBounds(d);
  return { dx: 12 - (b.minX + b.maxX) / 2, dy: 12 - (b.minY + b.maxY) / 2 };
}

// One badge as an SVG drawing, each shape its own path (Pixi would read shapes in one path as holes).
// The icon (and its cut) is moved so it sits dead centre, however it was drawn.
export function badgeSvg(b: TraitBadge): string {
  const { dx, dy } = centering(b.d);
  const draw = (d: string, fill: string) => paths(shiftPath(d, dx, dy)).map((s) => `<path d="${s}" fill="${fill}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${draw(b.d, hex(b.ink ?? 0xffffff))}${b.cut ? draw(b.cut, hex(b.color)) : ''}</svg>`;
}

const badgeHtml = (b: TraitBadge, title: string) => `<span class="trait-badge" style="background:${hex(b.color)}" title="${title}">${badgeSvg(b)}</span>`;

export const traitBadgeHtml = (id: string) => badgeHtml(TRAIT_BADGES[id], TRAITS[id].name);

export const bearerBadgeHtml = (trait: string) => badgeHtml(BEARER_BADGES[trait], `${TRAITS[trait].name} bearer`);
