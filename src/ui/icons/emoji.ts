import { ITEMS } from '../../game/items';
import { COMMANDERS } from '../../game/commanders';
import { POWER_CARDS } from '../../game/powerCards';
import { GLOVES } from '../../game/gloves';
import { ITEM_SVGS, GLOVE_SVGS } from './items';
import { COMMANDER_SVGS } from './commanders';
import { COMMANDER_CARD_SVGS } from './commanderCards';
import { POWER_CARD_SVGS } from './powerCards';

// Hand-drawn stand-ins for every emoji the UI and the game's texts use (hero portraits aside: those stay emoji
// for now, see portraits.ts). Game code keeps writing emoji, they're its vocabulary; `iconize` swaps them for
// these drawings at render time, so no emoji font is ever needed (Windows 10 lacks the newer ones).
//
// 24x24, flat colours, no gradients, ids or transforms: the board draws some of these through Pixi's SVG parser.

const f = (d: string, c: string) => `<path d="${d}" fill="${c}"/>`;
const fe = (d: string, c: string) => `<path d="${d}" fill="${c}" fill-rule="evenodd"/>`;
const s = (d: string, c: string, w = 2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const o = (cx: number, cy: number, r: number, c: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`;
const ring = (cx: number, cy: number, r: number, c: string, w = 2) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
const box = (x: number, y: number, w: number, h: number, rx: number, c: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c}"/>`;
const n = (v: number) => String(Math.round(v * 100) / 100);
// An n-pointed star centred on (cx, cy), point up.
const starD = (cx: number, cy: number, R: number, r: number, points = 5) =>
  'M' +
  Array.from({ length: points * 2 }, (_, i) => {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rr = i % 2 ? r : R;
    return `${n(cx + rr * Math.cos(a))} ${n(cy + rr * Math.sin(a))}`;
  }).join('L') +
  'Z';
const star = (cx: number, cy: number, R: number, r: number, c: string, points = 5) => f(starD(cx, cy, R, r, points), c);

const GOLD = '#f2c14e';
const GOLD_D = '#b8862b';
const RED = '#e5534b';
const RED_D = '#a8322c';
const BLUE = '#4a9eff';
const BLUE_D = '#2a64b8';
const ICE = '#9fe3ff';
const PURPLE = '#a371f7';
const PURPLE_D = '#6e40c9';
const GREEN = '#56d364';
const GREEN_D = '#2ea043';
const BROWN = '#b5713a';
const BROWN_D = '#6b4423';
const GREY = '#9aa4b2';
const GREY_D = '#5c6672';
const WHITE = '#f0f3f6';
const DARK = '#2d333b';
const ORANGE = '#f0883e';
const PINK = '#f778ba';
const SKIN = '#f2c9a0';
const STEEL = '#c9d1d9';

const HEART = 'M12 21C5 16.2 2.5 12.6 2.5 9A4.8 4.8 0 0 1 12 6.6 4.8 4.8 0 0 1 21.5 9C21.5 12.6 19 16.2 12 21Z';
const CLOUD = 'M6.5 15.5A4 4 0 0 1 6.8 7.6 5.5 5.5 0 0 1 17.3 7 3.8 3.8 0 0 1 17.5 15.5Z';
const FACE = (c: string) => o(12, 12, 9.5, c);
const FIST = 'M6 9.5A1.8 1.8 0 0 1 9.5 9 1.8 1.8 0 0 1 13 9 1.8 1.8 0 0 1 16.5 9.3 1.8 1.8 0 0 1 19.5 10.5V15C19.5 18.5 17 21 13.5 21H11C8 21 6 19 6 16Z';

export const UI_ICONS: Record<string, string> = {
  // Money and loot
  '💰':
    f('M9 2.5h6L13.5 6h-3Z', GOLD_D) +
    f('M10.5 6h3C18 8.6 20.5 12.6 20.5 16.2 20.5 19.8 17 21.5 12 21.5S3.5 19.8 3.5 16.2C3.5 12.6 6 8.6 10.5 6Z', GOLD) +
    s('M13.9 11.3C13.3 10.4 10.2 10.2 10.2 12 10.2 14 14 13.3 14 15.3 14 17.1 10.8 17 10 16M12 9.6v8.2', BROWN_D, 1.5),
  '💵': box(2, 6, 20, 12, 2, GREEN_D) + box(4, 8, 16, 8, 1, '#7ad38a') + o(12, 12, 2.6, GREEN_D) + o(6.5, 12, 1, GREEN_D) + o(17.5, 12, 1, GREEN_D),
  '💎': f('M7 4h10l4 5-9 12L3 9Z', '#6cc4ff') + f('M3 9h18L12 21Z', '#3d8fe0') + s('M7 4l2.5 5L12 4l2.5 5L17 4M9.5 9 12 21l2.5-12', '#d7efff', 1.1),
  '🎁':
    box(3, 8, 18, 4, 1, RED) +
    box(4.5, 12, 15, 9, 1, RED_D) +
    box(10.8, 8, 2.4, 13, 0, GOLD) +
    f('M12 7.6C10.2 3.6 6.2 3.8 6.8 6.4 7.2 8 10 8 12 7.6ZM12 7.6C13.8 3.6 17.8 3.8 17.2 6.4 16.8 8 14 8 12 7.6Z', GOLD),
  '📦': f('M3 7.5 12 3l9 4.5v10L12 22l-9-4.5Z', '#c8955a') + f('M3 7.5 12 12l9-4.5L12 3Z', '#e2b47c') + s('M12 12v10M7.5 5.2l9 4.5', BROWN_D, 1.3),
  '🛒': s('M2 4h3l2.5 11h11L21 7.5H6.2', GREY, 2) + o(9, 19, 1.8, GREY) + o(17, 19, 1.8, GREY),
  '🎒':
    f('M6 8a6 6 0 0 1 12 0v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20Z', BROWN) +
    s('M9 7V5.5a3 3 0 0 1 6 0V7', BROWN_D, 1.8) +
    f('M8.5 13h7a1 1 0 0 1 1 1v4h-9v-4a1 1 0 0 1 1-1Z', BROWN_D) +
    s('M8.5 15.5h7', '#e0a868', 1.2),
  '💼': box(2.5, 7, 19, 13, 2, BROWN) + s('M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', BROWN_D, 1.8) + s('M2.5 12.5h19', BROWN_D, 1.4) + box(10.5, 11, 3, 3, 0.6, GOLD),
  '🏆':
    f('M7 3h10v5a5 5 0 0 1-10 0Z', GOLD) +
    s('M7 5H4.5v1.5A3.5 3.5 0 0 0 8 10M17 5h2.5v1.5A3.5 3.5 0 0 1 16 10', GOLD_D, 1.6) +
    f('M10.8 12.8h2.4v3.7h-2.4Z', GOLD_D) +
    box(7.5, 16.5, 9, 4.5, 1, BROWN_D),
  '🏅': f('M6 2h4l3 7H9Z', RED) + f('M18 2h-4l-3 7h4Z', BLUE) + o(12, 15, 6.2, GOLD) + star(12, 15, 3.8, 1.6, GOLD_D),
  '🎖': f('M7 2h10l-3 8h-4Z', BLUE) + s('M12 2.5v7', RED, 2.2) + o(12, 15.5, 5.8, GOLD) + star(12, 15.5, 3.6, 1.5, GOLD_D),
  '👑': f('M3 8l4.5 4L12 4l4.5 8L21 8l-2 11H5Z', GOLD) + box(5, 19.5, 14, 2, 0.6, GOLD_D) + o(12, 13.5, 1.5, RED),
  '🎩': box(7, 3, 10, 13, 1.5, DARK) + box(3, 15.5, 18, 3.5, 1.7, DARK) + box(7, 12, 10, 2.2, 0, RED),
  '🧿': o(12, 12, 9.5, BLUE_D) + o(12, 12, 6.5, WHITE) + o(12, 12, 4, '#6cc4ff') + o(12, 12, 2, DARK),
  '🍀': o(9, 9, 3.6, GREEN) + o(15, 9, 3.6, GREEN) + o(9, 15, 3.6, GREEN) + o(15, 15, 3.6, GREEN) + s('M12 12c1 4 2.5 6.5 5 9', GREEN_D, 1.8),
  '🎲': box(3, 3, 18, 18, 4, WHITE) + o(7.5, 7.5, 1.7, RED) + o(12, 12, 1.7, RED) + o(16.5, 16.5, 1.7, RED) + o(16.5, 7.5, 1.7, RED) + o(7.5, 16.5, 1.7, RED),
  '🎴': box(5, 2.5, 14, 19, 2, RED_D) + box(7, 4.5, 10, 15, 1, '#f6e7d2') + o(12, 9.5, 2.6, RED) + s('M12 12v5M9.5 17h5', GREEN_D, 1.6),
  '🃏': box(5, 2.5, 14, 19, 2, WHITE) + star(12, 12, 5, 2.2, PURPLE) + f('M7 4.5h2.5L7 8Z', RED) + f('M17 19.5h-2.5L17 16Z', RED),
  '🟪': box(3.5, 3.5, 17, 17, 3, PURPLE),
  '🟧': box(3.5, 3.5, 17, 17, 3, ORANGE),
  '🟣': o(12, 12, 9, PURPLE),
  '🔵': o(12, 12, 9, BLUE),
  '🔶': f('M12 2.5 21.5 12 12 21.5 2.5 12Z', ORANGE) + f('M12 6 18 12 12 18 6 12Z', '#f6b26b'),
  '💠': f('M12 2.5 21.5 12 12 21.5 2.5 12Z', BLUE) + f('M12 7 17 12 12 17 7 12Z', ICE) + o(12, 12, 1.8, BLUE_D),
  '🔮': f('M6.5 21.5h11l-1.5-3h-8Z', BROWN) + o(12, 10.5, 7.5, PURPLE) + o(9.6, 8.1, 2.1, '#dcc8ff'),

  // Stats and combat
  '❤': f(HEART, RED),
  '♥': f(HEART, RED),
  '❣': f('M12 15.5C6 11.5 4 8.6 4 6A4 4 0 0 1 12 4.2 4 4 0 0 1 20 6C20 8.6 18 11.5 12 15.5Z', RED) + o(12, 19.8, 2, RED),
  '💞': f('M9.5 20C4.5 16.5 2.5 13.8 2.5 11.2A3.6 3.6 0 0 1 9.5 9.6 3.6 3.6 0 0 1 16.5 11.2C16.5 13.8 14.5 16.5 9.5 20Z', PINK) + f('M16 12.5C12.7 10.2 11.5 8.4 11.5 6.7A2.4 2.4 0 0 1 16 5.6 2.4 2.4 0 0 1 20.5 6.7C20.5 8.4 19.3 10.2 16 12.5Z', '#ffb3d9'),
  '🗡': f('M19.5 2.5 21.5 4.5 10 16 8 14Z', STEEL) + s('M5.5 12.5l6 6', GOLD_D, 2.2) + s('M8 16l-4.5 4.5', BROWN_D, 2.6),
  '⚔': s('M4 4l12 12M20 4 8 16', STEEL, 2.4) + s('M14 18l4-4M10 18l-4-4', GOLD_D, 2) + s('M18 18l2.5 2.5M6 18l-2.5 2.5', BROWN_D, 2.4),
  '🛡': f('M12 2l8.5 3.2V12c0 5-3.8 8.6-8.5 10-4.7-1.4-8.5-5-8.5-10V5.2Z', '#6e7f99') + f('M12 4.6l6.3 2.4V12c0 3.8-2.8 6.6-6.3 7.8Z', '#9fb0c8'),
  '✨': star(10, 13, 7, 1.8, GOLD, 4) + star(18, 5.5, 3.5, 1, '#ffe08a', 4) + star(18.5, 18, 2.4, 0.8, '#ffe08a', 4),
  '⚡': f('M14 1.5 4.5 13.5h6l-1.5 9 10-12.5h-6.2Z', GOLD),
  '🎯': o(12, 12, 9.5, RED) + o(12, 12, 6.8, WHITE) + o(12, 12, 4.1, RED) + o(12, 12, 1.6, WHITE),
  '💧': f('M12 2.5C15 7 18.5 10.6 18.5 14.5A6.5 6.5 0 0 1 5.5 14.5C5.5 10.6 9 7 12 2.5Z', BLUE) + s('M9 14.5a3 3 0 0 0 2.5 3', ICE, 1.6),
  '🔋': box(3, 7, 16, 10, 2, GREY_D) + box(19, 10, 2.5, 4, 1, GREY_D) + box(5, 9, 9, 6, 1, GREEN),
  '💥': f(starD(12, 12, 10.5, 5, 8), ORANGE) + f(starD(12, 12, 6, 3, 8), GOLD),
  '🔻': f('M3.5 6h17L12 20Z', RED),
  '🔨': f('M3 6.5 9.5 3l3.3 1.8L11 8 6.5 9.8Z', GREY_D) + s('M9.5 7.5 20 18', BROWN, 2.8),
  '🌀': s('M12 12.5a1.5 1.5 0 1 1 1.6-1.4 3.5 3.5 0 1 1-5 3.2 5.8 5.8 0 1 1 9.8 2.6 8.4 8.4 0 0 1-12.2.8', BLUE, 2),
  '💢': s('M4 9.5h3.5a2 2 0 0 0 2-2V4M14.5 4v3.5a2 2 0 0 0 2 2H20M20 14.5h-3.5a2 2 0 0 0-2 2V20M9.5 20v-3.5a2 2 0 0 0-2-2H4', RED, 2.4),
  '📜': f('M6 4h12v14a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 8 18V6Z', '#e8d3a8') + f('M5 3.5h11a2 2 0 0 1 0 4H5a2 2 0 0 1 0-4Z', '#c9ab72') + s('M10.5 11h5M10.5 14h5', BROWN, 1.3),
  '👊': f(FIST, SKIN) + s('M9.5 9v3M13 9v3M16.5 9.3V12M6 12.8h3.5', '#c89a70', 1.2),
  '🤛': f('M3 9h11.5a2.5 2.5 0 0 1 0 5H13a2 2 0 0 1 0 4H8c-3 0-5-2-5-4.5Z', SKIN) + s('M7 9V6.5M11 9V6.8', '#c89a70', 1.2) + f('M14.5 9H21v6h-6.5', SKIN),
  '🔁': s('M5 11V9.5A3 3 0 0 1 8 6.5h11M16 3.5l3 3-3 3M19 13v1.5a3 3 0 0 1-3 3H5M8 20.5l-3-3 3-3', BLUE, 2),
  '🔰': f('M12 22 5 17V4l7 5Z', GREEN) + f('M12 22l7-5V4l-7 5Z', GOLD),
  '🎭': f('M3 4h8v6.5a4 4 0 0 1-8 0Z', WHITE) + f('M13 9h8v6.5a4 4 0 0 1-8 0Z', GOLD) + s('M5 8h1.2M8 8h1.2M15 13h1.2M18 13h1.2M5.5 12a2 2 0 0 0 3 0M15.5 17.5a2 2 0 0 1 3 0', DARK, 1.2),
  '🥊': f('M6 5a5 5 0 0 1 9.5-1.4A4 4 0 0 1 19.5 8v4c0 3-2 5-5 5H8.5L6 14Z', RED) + box(6.5, 16.5, 9, 5, 1, WHITE) + s('M9.5 10c1.5-1 3.5-1 5 0', RED_D, 1.4),

  // Arrows, marks, checks
  '▶': f('M7 4.5 19.5 12 7 19.5Z', GREEN),
  '⬆': f('M12 3 20 11h-5v9.5H9V11H4Z', BLUE),
  '✔': s('M4.5 12.5l5 5L20 7', GREEN, 3),
  '❗': f('M9.8 3h4.4l-.9 12h-2.6Z', RED) + o(12, 19, 2, RED),
  '❔':
    o(12, 12, 10, '#6e7681') + s('M9.2 9.3a2.9 2.9 0 1 1 4.1 2.6c-.9.5-1.3 1.1-1.3 2.1', WHITE, 2.2) + o(12, 17.6, 1.3, WHITE),
  '🔗': s('M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1', STEEL, 2.4),
  '🔓': box(5, 11, 14, 10, 2.5, GOLD) + s('M8.5 11V8a3.5 3.5 0 0 1 6.7-1.4', GREY, 2.2) + o(12, 16, 1.5, GOLD_D),
  '🧩': f('M4 7h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 0 0-4Z', GREEN),
  '📊': box(3, 13, 4, 8, 1, BLUE) + box(10, 8, 4, 13, 1, GREEN) + box(17, 3, 4, 18, 1, ORANGE),
  '📋': box(5, 4, 14, 18, 2, '#c8955a') + box(7, 6.5, 10, 13.5, 1, WHITE) + box(9, 2.5, 6, 3, 1, GREY_D) + s('M9 10h6M9 13h6M9 16h4', GREY, 1.3),
  '✏': f('M15.5 3.5 20.5 8.5 9 20H4v-5Z', GOLD) + f('M15.5 3.5l2-2 5 5-2 2Z', PINK) + f('M4 15 9 20H4Z', SKIN),
  '🗑': box(5, 7, 14, 14.5, 2, GREY) + box(3.5, 4.5, 17, 2.5, 1, GREY_D) + box(9.5, 2.5, 5, 2.5, 1, GREY_D) + s('M9.5 10.5v8M14.5 10.5v8', GREY_D, 1.4),
  '👍': f('M7 10h2.5l3.5-7c1.6 0 2.5 1.2 2.2 2.8L14.5 9.5h4.8a2 2 0 0 1 2 2.4l-1.4 7A2.5 2.5 0 0 1 17.4 21H7Z', SKIN) + box(2.5, 10, 4, 11, 1, BLUE),
  '✋': f('M7 11V5.5a1.5 1.5 0 0 1 3 0V10V3.8a1.5 1.5 0 0 1 3 0V10V4.8a1.5 1.5 0 0 1 3 0V11V7.5a1.5 1.5 0 0 1 3 0V15c0 4-2.8 7-6.8 7-3 0-4.6-1.4-6-3.6L3.6 14a1.5 1.5 0 0 1 2.4-1.8Z', SKIN),
  '🤚': f('M7 11V5.5a1.5 1.5 0 0 1 3 0V10V3.8a1.5 1.5 0 0 1 3 0V10V4.8a1.5 1.5 0 0 1 3 0V11V7.5a1.5 1.5 0 0 1 3 0V15c0 4-2.8 7-6.8 7-3 0-4.6-1.4-6-3.6L3.6 14a1.5 1.5 0 0 1 2.4-1.8Z', '#e8b48a'),
  '🤝': f('M2 8l4-2 6 3 6-3 4 2v7l-4 2-3 3-3-2-3 2-3-3-4-2Z', SKIN) + s('M8 13l3 3M10.5 11.5l3.5 3.5M13 10l3 3M12 9 9 12', '#c89a70', 1.3),
  '👥': o(9, 8, 3.6, BLUE) + f('M2 20a7 7 0 0 1 14 0Z', BLUE) + o(16.5, 7, 3, '#7db8ff') + f('M15.5 12.4A6 6 0 0 1 22.5 18h-5a8 8 0 0 0-2-5.6Z', '#7db8ff'),
  '🧍': o(12, 5, 3, BLUE) + f('M8.5 9.5h7l-1 6.5h-1.5V22h-3v-6H9.5Z', BLUE),
  '🦸': f('M8 10 3.5 21h17L16 10Z', RED) + o(12, 5.5, 3.2, SKIN) + f('M9 9.5h6l-.8 7.5h-4.4Z', BLUE) + s('M10.5 17v4.5M13.5 17v4.5', BLUE_D, 1.6),
  '🏃': o(15, 4.5, 2.6, ORANGE) + s('M13.5 8.5 10 13l4 2.5-1.5 6M10 13l-4.5 2M13.5 8.5l3 3 3-1M10.8 9.5 7 9l-2 3', ORANGE, 2.3),
  '🗣': f('M4 21v-3a3 3 0 0 1-1-2.3c0-.9.5-1.6 1-2.3-.2-.7-.2-1.6.2-2.4C5.3 6.3 7.8 4 11 4c3.7 0 6 2.5 6 6 0 2.2-1 3.5-2 4.5v6.5Z', GREY_D) + s('M19 8c1 1.2 1 3 0 4.3M21 6c2 2.5 2 5.8 0 8.3', GREY, 1.6),

  // Weather, nature, sky
  '🔥': f('M12 2C13 7 19 9 19 15C19 19 16 22 12 22C8 22 5 19 5 15C5 12 7 10 8.5 8C9 10 10 11 11.5 11C12.5 8 11 5 12 2Z', ORANGE) + f('M12 12.5c.5 2.5 3.3 3.5 3.3 6a3.3 3.3 0 0 1-6.6 0c0-1.5 1-2.6 1.8-3.4.3 1 .9 1.5 1.5 1.5.4-1.2 0-2.6 0-4.1Z', GOLD),
  '♨': f('M3 15.5h18a9 6 0 0 1-18 0Z', RED_D) + s('M7.5 12c-1.5-2 1.5-3.5 0-6M12 12c-1.5-2 1.5-3.5 0-6.5M16.5 12c-1.5-2 1.5-3.5 0-6', RED, 2),
  '❄': s('M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 3.8 12 6l2.5-2.2M9.5 20.2 12 18l2.5 2.2M3.5 10.2l3.2-.6-1-3.2M20.5 13.8l-3.2.6 1 3.2M3.5 13.8l3.2.6-1 3.2M20.5 10.2l-3.2-.6 1-3.2', ICE, 1.8),
  '🧊': f('M4 8 12 4l8 4v9l-8 4-8-4Z', '#bfeaff') + f('M4 8l8 4 8-4-8-4Z', '#e5f7ff') + f('M12 12v9l8-4V8Z', '#8fd3f5'),
  '🌫': s('M3 7.5c3-2.5 6-2.5 9 0s6 2.5 9 0M3 12.5c3-2.5 6-2.5 9 0s6 2.5 9 0M3 17.5c3-2.5 6-2.5 9 0s6 2.5 9 0', GREY, 2),
  '🌪': s('M3 4.5h18M5.5 8.5h13M8 12.5h9M10 16.3h5.5M11.5 20h3', GREY, 2.3),
  '🌬': s('M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7', ICE, 2),
  '🌊': f('M2 15c2-4 5-6 8.5-5.5-2 .8-3 2.5-2 4.5 1.2 2.2 4.5 2 6-.5 1.5 3 4.5 3.2 7.5 1.5V21H2Z', BLUE) + s('M2 18.5c2.5 1.4 5 1.4 7.5 0s5-1.4 7.5 0 3.5 1 5 0', ICE, 1.3),
  '⛈': f(CLOUD, GREY_D) + f('M11.5 13 8.5 18h2.5l-1 4.5 4-6h-2.5l1.5-3.5Z', GOLD) + s('M6.5 18l-1 2.5M17 18l-1 2.5', BLUE, 1.6),
  '🌩': f(CLOUD, GREY) + f('M12.5 13 9 18.5h3l-1.2 4 4.7-6.3h-3l1.7-3.2Z', GOLD),
  '☀': o(12, 12, 4.6, GOLD) + s('M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1', GOLD, 2),
  '🔆': ring(12, 12, 4.2, GOLD, 2.2) + s('M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1', GOLD, 2),
  '🎇': s('M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8', GOLD, 1.8) + o(12, 12, 2.2, '#fff3b0'),
  '☄': f('M13 4.8 2.5 18.5 5.5 21.5 19.2 11Z', '#f6c177') + o(16.5, 7.5, 4.5, ORANGE) + o(16.5, 7.5, 2, '#ffe1a8'),
  '💫': s('M13.5 13a2 2 0 1 1-3.1-1.6 4 4 0 1 1 5.6 5.1A6.2 6.2 0 1 1 7 8.2', GOLD, 1.8) + star(19, 4.8, 3, 1.2, GOLD),
  '⭐': star(12, 12.5, 10, 4.2, GOLD),
  '🌟': star(12, 12.5, 10, 4.2, GOLD) + star(12, 12.5, 5, 2.1, '#fff1b8'),
  '🌠': f('M3 20 13 9l2 2L4 21Z', '#ffe08a') + star(16, 8, 6, 2.5, GOLD),
  '🌑': o(12, 12, 9.5, '#3b3552') + ring(12, 12, 9.5, '#8b80a8', 1.3),
  '🌗': o(12, 12, 9.5, '#3b3552') + f('M12 2.5a9.5 9.5 0 0 1 0 19Z', '#f2e3a0'),
  '🌘': o(12, 12, 9.5, '#3b3552') + f('M12 2.5a9.5 9.5 0 0 1 0 19 13 13 0 0 0 0-19Z', '#f2e3a0'),
  '⛰': f('M1.5 20.5 9 7l4 6 2.5-3.5 7 11Z', '#8b7a66') + f('M9 7l2.6 3.9-1.6-.7-1.2 1.6L7.3 10Z', WHITE),
  '🏔': f('M1.5 20.5 9.5 5l5 8.5 2.5-3.5 5.5 10.5Z', '#7d8fa6') + f('M9.5 5l2.7 4.6-1.3-.6-1.4 1.5-1.4-1.5-1.4.8Z', WHITE) + f('M17 10l1.8 3.4-1.8-.8-1.3.9Z', WHITE),
  '🌋': f('M2 21 9 9h6l7 12Z', BROWN_D) + f('M9 9h6l-1.5 3.5-1.5-1-1.5 1.5-1.5-1.5Z', RED) + f('M10 7c-.5-2 1-3.5 2-5 0 2 2.5 2.5 2 5Z', ORANGE),
  '🌳': o(12, 9, 6.5, GREEN_D) + o(7.5, 11.5, 4, GREEN) + o(16.5, 11.5, 4, GREEN) + box(10.8, 13, 2.4, 9, 0.8, BROWN),
  '🌸': o(12, 6.8, 3.6, PINK) + o(17, 10.4, 3.6, PINK) + o(15.1, 16.2, 3.6, PINK) + o(8.9, 16.2, 3.6, PINK) + o(7, 10.4, 3.6, PINK) + o(12, 12, 2.6, GOLD),
  '🥀': s('M12 11c1 4 0 7-1.5 10.5', GREEN_D, 1.8) + f('M14 13c2 0 3.5 1 4 2.5-2 .5-3.5 0-4-2.5Z', GREEN_D) + f('M7 6c1-3 4-3.5 5.5-2 1.8-1.5 4.5-.8 5 1.6.5 2.6-2 5.6-5.5 5.4C8.5 11 6.3 8.5 7 6Z', RED_D) + f('M9.5 12.5 8 15l2.5-1.5Z', RED_D),
  '🍃': f('M4 20C4 11 9.5 5 20 4c0 10-6 16-16 16Z', GREEN) + s('M4 20 15 9', GREEN_D, 1.4),
  '🐚': f('M12 3 21 17c-3 3-15 3-18 0Z', '#f6c9b8') + s('M12 3 7 18.8M12 3l5 15.8M12 3v16.5', '#d48c78', 1.2),
  '🐾': o(12, 15.5, 4.5, BROWN) + o(6, 10.5, 2.1, BROWN) + o(9.5, 6, 2.1, BROWN) + o(14.5, 6, 2.1, BROWN) + o(18, 10.5, 2.1, BROWN),

  // Creatures and faces
  '👹': fe('M4.5 3 8 8.2Q12 6.4 16 8.2L19.5 3 19 10.2Q20.6 12.4 20 15.6 19.2 20.6 12 21.5 4.8 20.6 4 15.6 3.4 12.4 5 10.2ZM7.6 11.6 11 13.4 7.6 15.2ZM16.4 11.6 13 13.4 16.4 15.2ZM9 17.4H15L14.2 19.2 13.1 18.2 12 19.5 10.9 18.2 9.8 19.2Z', RED),
  '😈': f('M4 3l4 4.5h8L20 3l-.5 6.5A9 9 0 1 1 4.5 9.5Z', PURPLE) + s('M8 11.5l2.5 1.2M16 11.5l-2.5 1.2M8.5 16a5 5 0 0 0 7 0', DARK, 1.6),
  '😡': FACE(RED) + s('M7 9.5l3 1.3M17 9.5l-3 1.3M8.5 17a5 5 0 0 1 7 0', DARK, 1.6),
  '😇': ring(12, 3.2, 1, GOLD, 0) + f('M5.5 3.5a6.5 2 0 0 1 13 0 6.5 2 0 0 1-13 0Zm2.4 0a4.1 1 0 0 0 8.2 0 4.1 1 0 0 0-8.2 0Z', GOLD) + o(12, 14, 8, '#ffd76a') + s('M8.5 13c.8-.8 1.7-.8 2.5 0M13 13c.8-.8 1.7-.8 2.5 0M9 16.5a4 4 0 0 0 6 0', DARK, 1.4),
  '💀': f('M12 2.5C7 2.5 4 6.3 4 10.5c0 3 1.5 5 4 6v4.5h8v-4.5c2.5-1 4-3 4-6 0-4.2-3-8-8-8Z', WHITE) + o(8.8, 11, 2.1, DARK) + o(15.2, 11, 2.1, DARK) + s('M10.5 18v3M13.5 18v3', DARK, 1.2),
  '☠': f('M12 2.5C8 2.5 5.5 5.5 5.5 9c0 2.3 1.2 4 3 4.8V17h7v-3.2c1.8-.8 3-2.5 3-4.8 0-3.5-2.5-6.5-6.5-6.5Z', WHITE) + o(9.5, 9.5, 1.7, DARK) + o(14.5, 9.5, 1.7, DARK) + s('M4 15l16 6M20 15 4 21', WHITE, 2.2),
  '👻': fe('M12 2C7 2 4 6 4 11V22L7 19.5L9.5 22L12 19.5L14.5 22L17 19.5L20 22V11C20 6 17 2 12 2ZM9 8L11 11L9 14L7 11ZM15 8L17 11L15 14L13 11Z', WHITE),
  // A whole dragon, side on, facing right: bat wing up behind, S-curved neck, horned head, tail curling under.
  '🐉':
    f('M12.4 10.4 2.2 1.8C4.4 4.6 4.4 6.6 1.6 8.6 4.4 8.4 5.8 9.8 5.2 12.4 7.6 11 10 11.2 12.2 12.8Z', '#2e8f45') +
    s('M12.4 10.6 2.2 1.8M12.2 11 1.6 8.6M12.2 11.6 5.2 12.4', '#1b6b2e', 1.1) +
    f('M13.2 4.6C11 6.4 10.2 9 11 11.4 11.6 13 12.4 14.2 11.6 15.3 10.4 16.6 7.4 15.9 5 16.4 2.6 16.9 2 19.3 3.6 20.6 3.3 19.2 4.2 18.4 5.6 18.6 8.6 19.1 12.5 19.4 14.6 17.4 16.6 15.4 16 12.8 15.2 11 14.5 9.4 14.6 7.6 15.8 6.4Z', GREEN) +
    f('M13.2 4.4C14.2 3 16 2.5 18 2.9L21.6 4.4C22.2 4.8 22 5.7 21.2 5.9L18.6 6.3C17.6 7.4 16 7.6 14.8 6.9Z', GREEN) +
    f('M14.4 3.5 11.8 1 15.6 2.8ZM16.2 3 15.6.6 17.4 2.8Z', '#e8dcc0') +
    f('M18.6 6.3 21.2 5.9 20.4 7.4 18.4 7.2Z', '#1f7a33') +
    f('M12.3 6.5 10.6 6.2 11.8 8ZM11.3 9.2 9.6 9.2 11 10.8ZM15.6 12 17.4 11.6 16.3 13.6ZM16.2 14.6 18 15 16.4 16.4Z', GREEN_D) +
    f('M13.5 15.5 14.4 15.6 15.2 18.8 13 18.2ZM9.5 16.4 10.6 16.1 10.8 19.2 8.8 19Z', GREEN_D) +
    f('M3.6 20.6 1.5 21.8 2.3 19.6Z', GREEN_D) +
    o(17.6, 4.2, 0.8, GOLD),
  // A dragon's face, head on: horns, glaring eyes, a pale snout and whiskers.
  '🐲':
    f('M6.5 9 2.8 2.5 8.6 6.6ZM17.5 9l3.7-6.5-5.8 4.1Z', '#e8dcc0') +
    f('M9 5.4 10 2.4 11.2 4.8ZM12.8 4.8 14 2.4 15 5.4Z', GREEN_D) +
    f('M5 10.2C5 6.7 8 4.5 12 4.5S19 6.7 19 10.2L18 14C19.5 15 20 16.5 19.5 18.5 19 20.5 16.5 21.5 12 21.5S5 20.5 4.5 18.5C4 16.5 4.5 15 6 14Z', GREEN) +
    f('M7.5 15.8C8.5 14.3 10.3 13.6 12 13.6S15.5 14.3 16.5 15.8C17 17.3 16.5 18.8 15 19.3H9C7.5 18.8 7 17.3 7.5 15.8Z', '#9be8a6') +
    f('M6.8 10.2 10.6 11.2 10 12.8 7 11.6ZM17.2 10.2 13.4 11.2 14 12.8 17 11.6Z', GOLD) +
    o(9.6, 11.8, 0.6, DARK) +
    o(14.4, 11.8, 0.6, DARK) +
    o(10.2, 16.4, 0.8, '#1f7a33') +
    o(13.8, 16.4, 0.8, '#1f7a33') +
    s('M7 17.3C5 17.3 3.4 18.4 2.4 20.4M17 17.3C19 17.3 20.6 18.4 21.6 20.4', GOLD, 1.2),
  '🦖': f('M3 21v-5.5C3 9 7.5 3.5 13.5 3.5c4.5 0 7.5 2.2 7.5 5.2V11h-6.5l1.5 2.2h-3.5V21H9.5v-4h-3v4Z', '#5fae4f') + o(15.5, 7, 1.1, DARK),
  '🦇': f('M12 8c1 0 1.6.8 1.8 1.8C16 8 19 7 22 8.5c-1 .8-1.5 2-1.5 3.5-1.2-.8-2.6-.8-3.5.3-.8-.9-2.2-1.2-3.3-.6L12 15l-1.7-3.3c-1.1-.6-2.5-.3-3.3.6-.9-1.1-2.3-1.1-3.5-.3 0-1.5-.5-2.7-1.5-3.5C5 7 8 8 10.2 9.8 10.4 8.8 11 8 12 8Z', '#5a467d') + f('M10.8 8.4 10.5 6.4 11.7 7.9ZM13.2 8.4 13.5 6.4 12.3 7.9Z', '#5a467d'),
  '🐍': s('M5 20c4 0 4-4 7-4s3 4 6 4M12 16c-4 0-6-2-6-4.5S8 7 11 7h3', GREEN, 2.6) + f('M13.5 4.5h3.5a2.5 2.5 0 0 1 0 5h-3.5Z', GREEN) + o(16.5, 6.5, 0.8, DARK) + s('M19.5 7h2l.8-.8M21.5 7l.8.8', RED, 1),
  '🐻': o(6, 6, 3, BROWN) + o(18, 6, 3, BROWN) + o(12, 13, 8.5, BROWN) + f('M8.5 15.5a3.5 3 0 0 1 7 0 3.5 3 0 0 1-7 0Z', '#e3b07a') + o(9, 11, 1.2, DARK) + o(15, 11, 1.2, DARK) + o(12, 14.5, 1.3, DARK),
  '🦁': o(12, 12, 10, ORANGE) + o(12, 12.5, 6.8, GOLD) + o(9.5, 11, 1.1, DARK) + o(14.5, 11, 1.1, DARK) + f('M10.5 14h3L12 15.8Z', BROWN_D) + s('M10 17a2.5 2.5 0 0 0 4 0', BROWN_D, 1.2),
  '🐑': o(8, 9, 3.5, WHITE) + o(13, 7.5, 3.5, WHITE) + o(17, 10.5, 3.5, WHITE) + o(11, 13, 4, WHITE) + o(16, 14, 3.5, WHITE) + f('M3 9.5a3 2.5 0 0 1 6 0v2a3 3 0 0 1-6 0Z', DARK) + s('M9 16.5V21M15 17v4', DARK, 2),
  '🐢': f('M5 15a7 6.5 0 0 1 14 0Z', GREEN_D) + s('M8.5 10.5 12 15l3.5-4.5M5.5 15h13', GREEN, 1.2) + f('M18.5 13.5c1-1 2.5-1.5 3.5-.5s-.5 2.5-2 2.5Z', '#8bd17c') + s('M7 15.5 6 18.5M16.5 15.5l1 3', '#8bd17c', 2.2),
  '🐇': f('M9 9C8 5 8 2.5 9.5 2.5S11.5 5.5 11 9ZM13 9c0-4 1-6.5 2.5-6.5S17 5.5 15 9.5Z', '#e8e0d8') + o(12, 13, 5, '#e8e0d8') + f('M7 21a5 4 0 0 1 10 0Z', '#e8e0d8') + o(10, 12.5, 0.9, DARK) + o(14, 12.5, 0.9, DARK) + f('M11.2 14.5h1.6L12 15.5Z', PINK),
  '🗿': f('M7 21V8c0-3.5 2.2-5.5 5-5.5s5 2 5 5.5v13Z', GREY) + box(8, 9, 3, 1.6, 0.3, GREY_D) + box(13, 9, 3, 1.6, 0.3, GREY_D) + f('M12 10l1.2 5h-2.4Z', GREY_D) + box(9.5, 17, 5, 1.4, 0.5, GREY_D),

  // Places and things
  '📖': f('M12 6C9 4 6 4 2 5V20C6 19 9 19 12 21C15 19 18 19 22 20V5C18 4 15 4 12 6Z', '#e8d3a8') + s('M12 6v15', BROWN, 1.2) + s('M5 9c1.6-.3 3-.2 4.5.4M5 12.5c1.6-.3 3-.2 4.5.4M14.5 9.4c1.5-.6 2.9-.7 4.5-.4M14.5 12.9c1.5-.6 2.9-.7 4.5-.4', BROWN, 1),
  '📚': box(3, 4, 4.5, 17, 1, RED) + box(8.5, 6, 4.5, 15, 1, BLUE) + f('M14 7.5l3.8-1.2 4.2 13.3-3.8 1.2Z', GREEN) + s('M3 7.5h4.5M8.5 9h4.5', WHITE, 1),
  '🕯': box(8.5, 9, 7, 13, 1, '#f3e6c8') + s('M12 9V6.5', DARK, 1.2) + f('M12 1.5c1.8 2 2.3 3.2 2.3 4.2a2.3 2.3 0 0 1-4.6 0c0-1 .5-2.2 2.3-4.2Z', ORANGE),
  '⚰': f('M9 2h6l3 5-2 15H8L6 7Z', BROWN_D) + s('M12 7v8M9.5 9.5h5', '#d9b38c', 1.6),
  '🧱': box(2, 5, 20, 14, 1, '#b3502f') + s('M2 9.7h20M2 14.3h20M8 5v4.7M16 5v4.7M5 9.7v4.6M12 9.7v4.6M19 9.7v4.6M8 14.3V19M16 14.3V19', '#e8c4a8', 1.2),
  '🧵': box(6, 2.5, 12, 3, 1, BROWN) + box(6, 18.5, 12, 3, 1, BROWN) + box(7.5, 5.5, 9, 13, 0, PURPLE) + s('M7.5 8.5l9 2M7.5 12l9 2M7.5 15.5l9 2', PURPLE_D, 1.1),
  '🧭': o(12, 12, 9.8, GOLD_D) + o(12, 12, 7.8, WHITE) + f('M12 5.5 14 12h-4Z', RED) + f('M12 18.5 10 12h4Z', GREY_D),
  '♈': s('M12 21V10M12 10C12 5 9.5 3.5 7.5 3.5S4 5 4 7s1.5 3 3 3M12 10c0-5 2.5-6.5 4.5-6.5S20 5 20 7s-1.5 3-3 3', PURPLE, 2.4),
  '🖋': f('M12 2 17.5 9 14 17h-4L6.5 9Z', DARK) + o(12, 11, 1.3, GOLD) + s('M12 2v8', GOLD, 1) + box(9.5, 17, 5, 4.5, 1, GOLD_D),
  '🎌': s('M5 2.5v19', BROWN, 2) + f('M6 3.5h13l-2.5 4 2.5 4H6Z', WHITE) + o(11.5, 7.5, 2, RED),
  '⛏': s('M4 6c4-3.5 12-3.5 16 0', GREY, 2.6) + s('M12 4.5 12 21.5', BROWN, 2.4),
  '👣': f('M7 3c2 0 2.5 2.8 2.3 5.5-.2 2-1 3.5-2.5 3.5S4.5 10.5 4.6 8C4.8 5.5 5.2 3 7 3Z', BROWN) + o(7, 14.2, 1.8, BROWN) + f('M17 9c2 0 2.5 2.8 2.3 5.5-.2 2-1 3.5-2.5 3.5s-2.3-1.5-2.2-4C14.8 11.5 15.2 9 17 9Z', BROWN) + o(17, 20.2, 1.8, BROWN),
  '🦷': f('M6 3.5c2-.8 4 .3 6 .3s4-1.1 6-.3c2.5 1 2.5 5 1 8-1 2-1 5-2 9-.4 1.6-2 1.6-2.3 0L13.5 15c-.3-1.6-2.7-1.6-3 0l-1.2 5.5c-.3 1.6-1.9 1.6-2.3 0-1-4-1-7-2-9-1.5-3-1.5-7 1-8Z', WHITE),
  '🔭': f('M3 13 17.5 4.5l2 3.4L5 16.4Z', BLUE_D) + f('M17 3.5l2.4-1.4 3 5.2-2.4 1.4Z', BLUE) + s('M10 13.5 7 21.5M10 13.5l3 8', GREY_D, 1.8),
  '🗼': f('M10.5 2h3l1 6h-5Z', RED) + f('M9.5 8h5l1.5 7H8Z', RED_D) + f('M8 15h8l2.5 7h-3.5L12 18l-3 4H5.5Z', RED),
  '🍖': f('M14 4.5a6 6 0 0 1 5.5 5.5c0 4-4 7.5-8 7L9 14.5c-.5-4 2-10 5-10Z', '#c8553d') + s('M9.5 14.5l-4 4', WHITE, 2.4) + o(4.4, 18, 1.6, WHITE) + o(6, 19.6, 1.6, WHITE),
  '🎻': f('M12.5 6.5c2 0 3 1.5 2.5 3-.4 1 .8 1.6.8 3.2C15.8 15.5 14 18 11 18s-4.8-2.5-4.8-5.3c0-1.6 1.2-2.2.8-3.2-.5-1.5.5-3 2.5-3Z', BROWN) + s('M10.8 3v12', BROWN_D, 1.4) + s('M15 3 5 21', STEEL, 1),
  '☂': f('M2.5 12a9.5 8 0 0 1 19 0c-1-1-2.2-1-3.2 0-1-1-2.2-1-3.2 0-1-1-2.1-1-3.1 0-1-1-2.2-1-3.2 0-1-1-2.3-1-3.3 0Z', PURPLE) + s('M12 12v7.5a2 2 0 0 1-4 0', BROWN_D, 1.8) + s('M12 2.5V4', BROWN_D, 1.6),
  '🌂': f('M12 2.5 16 17h-8Z', PURPLE) + s('M12 17v2.5a2 2 0 0 1-4 0', BROWN_D, 1.8),
  '🎉': f('M3 21 8 8l8 8Z', GOLD) + s('M8 8l8 8', GOLD_D, 1.2) + s('M13 2.5V5', RED, 1.8) + s('M19 4.5l-2 2', BLUE, 1.8) + s('M21 10.5h-2.5', GREEN, 1.8) + o(16, 9, 1, PURPLE),
  '💃': o(13, 4.5, 2.5, SKIN) + f('M11 8h4l-.5 4 5 8H5.5l5-8Z', RED) + s('M11.5 8.5 7 6M14.5 8.5 19 11', SKIN, 1.8) + s('M10.5 20v2.5M14.5 20l1.5 2.5', SKIN, 1.8),
  '🧬': s('M7 2.5c0 6 10 7 10 13s-10 4-10 6M17 2.5c0 6-10 7-10 13s10 4 10 6', BLUE, 2) + s('M8.5 6h7M10 9.5h4M10 15.5h4M8.5 19h7', GREEN, 1.6),
  '⚱': f('M8 2.5h8v2h-1v1.5c3 1.5 4.5 4 4.5 7.5 0 4-2.5 7-5.5 8.5H10c-3-1.5-5.5-4.5-5.5-8.5 0-3.5 1.5-6 4.5-7.5V4.5H8Z', '#8a5a9e') + s('M6 11h12M7 15h10', GOLD, 1.4) + box(8.5, 20.5, 7, 1.5, 0.5, '#5e3a6e'),
  '🏰':f('M3 21V8h3v2h2.5V8h3v2H14V8h3v2h2.5V8h3v13h-8v-5a2.5 2.5 0 0 0-5 0v5Z', GREY),
  '🏦': f('M12 2.5 22 8H2Z', GREY) + box(3, 18.5, 18, 3, 0.5, GREY) + s('M5.5 10v7M10 10v7M14 10v7M18.5 10v7', GREY, 2),
};

// Emoji that are an item's, a commander's, a card's or a glove's: the same drawing as that thing, so
// "🧣 Red Cloak" in a text shows the Red Cloak. The UI's own drawings win over these.
function entityIcons(): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (emoji: string | undefined, svg: string | undefined) => {
    if (!emoji || !svg) return;
    const k = key(emoji);
    if (!(k in out)) out[k] = svg;
  };
  for (const [id, it] of Object.entries(ITEMS)) add(it.icon, ITEM_SVGS[id]);
  for (const [id, g] of Object.entries(GLOVES)) add(g.icon, GLOVE_SVGS[id]);
  for (const [id, c] of Object.entries(COMMANDERS)) {
    add(c.card?.icon, COMMANDER_CARD_SVGS[id]);
    add(c.icon, COMMANDER_SVGS[id]);
  }
  for (const [id, c] of Object.entries(POWER_CARDS)) add(c.icon, POWER_CARD_SVGS[id]);
  return out;
}

// One emoji, however written (with or without U+FE0F, or as a ZWJ sequence like 🧙‍♀️): its first symbol.
export const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?|[\u{1F3FB}-\u{1F3FF}])*/gu;
const key = (emoji: string) => [...emoji][0];

const doc = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

let table: Record<string, string> | null = null;
// Every drawing by emoji, as a whole SVG document.
export function emojiTable(): Record<string, string> {
  if (!table) {
    table = entityIcons();
    for (const [e, body] of Object.entries(UI_ICONS)) table[key(e)] = doc(body);
  }
  return table;
}

// The SVG for an emoji, if there's one.
export const emojiSvg = (emoji: string): string | undefined => emojiTable()[key(emoji)];

const imgs = new Map<string, string>();
// HTML: an emoji's drawing as an inline image the size of the text; the emoji itself if it has none.
export function emojiImg(emoji: string): string {
  const k = key(emoji);
  let html = imgs.get(k);
  if (html === undefined) {
    const svg = emojiTable()[k];
    html = svg ? `<img class="svg-icon emo" src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="" draggable="false">` : emoji;
    imgs.set(k, html);
  }
  return html;
}

// A tag, quotes respected (a title may hold a ">").
const TAG = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
// Elements whose text keeps its emoji: hero portraits (still emoji for now).
const KEEP = /\bdata-emoji\b/;

// Swaps every emoji in rendered HTML for its drawing. Inside tags (a title, an aria-label) an image can't go,
// so there the emoji is dropped. Text right inside an element marked `data-emoji` is left alone.
export function iconize(html: string): string {
  if (!html) return html;
  let out = '';
  let last = 0;
  let keep = false;
  const text = (t: string) => (keep ? t : t.replace(EMOJI, emojiImg));
  for (const m of html.matchAll(TAG)) {
    out += text(html.slice(last, m.index));
    const tag = m[0];
    out += tag.replace(EMOJI, '').replace(/="\s+/g, '="');
    keep = tag[1] !== '/' && KEEP.test(tag);
    last = m.index! + tag.length;
  }
  return out + text(html.slice(last));
}
