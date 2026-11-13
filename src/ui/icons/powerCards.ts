// Hand-drawn power card icons (64x64), replacing the cards' emoji, in the same style as the commander
// portraits (icons/commanders.ts): flat shapes with a dark outline. HTML only (the board never draws them),
// so transforms and nested <svg>s are fine. A card's emoji (PowerCardDef.icon) stays as the fallback.
// Cards about one item reuse that item's drawing (icons/items.ts); cards about one synergy wear its badge.
import { hex, TRAIT_BADGES } from '../traitBadges';
import { burst, line, MIRROR_X, OUTLINE, svg } from './commanders';
import { ITEM_SVGS } from './items';

// A shape drawn about (0, 0), moved to (x, y) and scaled.
const at = (x: number, y: number, s: number, body: string) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;

// Another 64x64 drawing, placed in the box (x, y, size).
const nest = (drawing: string, x: number, y: number, size: number) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 64 64">${drawing.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
const item = (id: string, x = 4, y = 4, size = 56) => nest(ITEM_SVGS[id], x, y, size);

// A synergy's badge (traitBadges.ts, on a 24 grid), as a disc centred at (x, y).
function badge(id: string, x = 50, y = 50, r = 12): string {
  const b = TRAIT_BADGES[id];
  const s = r * 1.44;
  const inner = `<path d="${b.d}" fill="${hex(b.ink ?? 0xffffff)}" stroke="none"/>` + (b.cut ? `<path d="${b.cut}" fill="${hex(b.color)}" stroke="none"/>` : '');
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${hex(b.color)}" stroke-width="2.2"/>` +
    `<svg x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" viewBox="0 0 24 24">${inner}</svg>`;
}

// The enhanced mark: a white four-point sparkle (top right).
const sparkle = (x = 52, y = 12, r = 10) =>
  `<polygon points="${burst(x, y, 4, r, r * 0.3)}" fill="#ffffff"/><polygon points="${burst(x, y, 4, r * 0.45, r * 0.15)}" fill="#ffd23f" stroke="none"/>`;

// --- Shapes about (0, 0), roughly 40 across ---
const COIN = `<circle r="18" fill="#ffd23f"/><circle r="12" fill="none" stroke="#c99a10" stroke-width="2"/><path d="M-4 -6h8M-4 6h8M0 -8v16" stroke="#c99a10" stroke-width="2.4"/>`;
const CHEST =
  `<rect x="-19" y="-5" width="38" height="22" rx="2" fill="#8a5530"/>` +
  `<path d="M-19 -5v-5a8 8 0 0 1 8-8h22a8 8 0 0 1 8 8v5z" fill="#b0703a"/>` +
  `<rect x="-19" y="-7" width="38" height="4" fill="#e0a63a"/><rect x="-4.5" y="-5" width="9" height="10" rx="1.5" fill="#ffd23f"/>`;
const HEART = `<path d="M0 17C-15 7-19-2-15-9c3-5 11-5 15 1 4-6 12-6 15-1 4 7 0 16-15 26z" fill="#e0394c"/>`;
const SHIELD = (fill: string, rim = '#c8d2e2') =>
  `<path d="M0 -21L18 -14V0C18 11 9 18 0 21-9 18-18 11-18 0V-14z" fill="${rim}"/><path d="M0 -15L12 -10V0C12 7 6 12 0 15-6 12-12 7-12 0V-10z" fill="${fill}"/>`;
const SWORD =
  `<path d="M0 -22L4.5 -16V8H-4.5V-16z" fill="#dfe6f0"/><path d="M0 -18V6" stroke="#9aa6b8" stroke-width="1.4"/>` +
  `<rect x="-11" y="8" width="22" height="4.5" rx="2" fill="#e0a63a"/><rect x="-2.5" y="12.5" width="5" height="8" fill="#6b3b1f"/><circle cy="22" r="2.8" fill="#e0a63a"/>`;
const FLAME = (outer = '#ff8a3d', inner = '#ffd23f') =>
  `<path d="M0 20C-13 20-17 9-12 0-9-6-2-9 0-21 5-13 9-10 12-3 17 7 12 20 0 20z" fill="${outer}"/>` +
  `<path d="M0 17C-6 17-8 11-5 6-3 3 0 1 1-5 4 0 6 3 6 7 7 12 5 17 0 17z" fill="${inner}"/>`;
const DROP = (fill = '#4a9ff5') => `<path d="M0 -21C-8 -9-15 0-15 7a15 15 0 0 0 30 0c0-7-7-16-15-28z" fill="${fill}"/><path d="M-8 6a8 8 0 0 0 5 8" fill="none" stroke="#ffffff" stroke-width="2.5"/>`;
const GEM = (fill = '#5fd0ff', dark = '#3aa8e0') =>
  `<path d="M-18 -7l9-11h18l9 11-18 25z" fill="${fill}"/><path d="M-18 -7h36L0 18z" fill="${dark}"/>` +
  `<path d="M-9 -18l-2 11 11 25 11-25-2-11M-11 -7l11-11 11 11" fill="none" stroke-width="1.4"/>`;
const SKULL =
  `<path d="M0 -20C-12 -20-18 -12-18 -3c0 6 3 10 7 12v8h22v-8c4-2 7-6 7-12 0-9-6-17-18-17z" fill="#ece6d6"/>` +
  `<circle cx="-7" cy="-3" r="5" fill="#2a2032"/><circle cx="7" cy="-3" r="5" fill="#2a2032"/><path d="M0 3l-3 5h6z" fill="#2a2032"/>` +
  `<path d="M-6 13v4M0 13v4M6 13v4" stroke="#2a2032" stroke-width="1.6"/>`;
const PAWN = (fill: string) => `<circle cy="-11" r="8" fill="${fill}"/><path d="M-6 -3h12l4 15H-10z" fill="${fill}"/><rect x="-13" y="12" width="26" height="7" rx="2" fill="${fill}"/>`;
const SCROLL =
  `<rect x="-17" y="-16" width="34" height="32" fill="#f0e0b0"/>` +
  `<rect x="-21" y="-21" width="42" height="8" rx="4" fill="#b0703a"/><rect x="-21" y="13" width="42" height="8" rx="4" fill="#b0703a"/>` +
  `<path d="M-11 -6h22M-11 0h18M-11 6h12" stroke="#8a6a3a" stroke-width="2"/>`;
const BACKPACK = (fill: string) =>
  `<path d="M-8 -16a8 6 0 0 1 16 0" fill="none" stroke="${OUTLINE}" stroke-width="4"/>` +
  `<rect x="-16" y="-14" width="32" height="34" rx="9" fill="${fill}"/><rect x="-11" y="2" width="22" height="13" rx="3" fill="#00000033"/>` +
  `<path d="M-11 6h22" stroke="${OUTLINE}" stroke-width="1.6"/>`;
const CASTLE =
  `<path d="M-18 20V-8h6v-6h5v6h4v-6h6v6h4v-6h5v6h6v28z" fill="#9aa2b2"/>` +
  `<path d="M-5 20v-10a5 5 0 0 1 10 0v10z" fill="#3a3248"/><rect x="-14" y="-2" width="5" height="7" fill="#3a3248"/><rect x="9" y="-2" width="5" height="7" fill="#3a3248"/>`;
const ARROW_UP = (fill: string) => `<path d="M0 -21L17 -3H7V19H-7V-3H-17z" fill="${fill}"/>`;
// A loop of arrow (a refresh), about (0, 0), radius 15.
const LOOP = (color: string) => line('M12 -9A15 15 0 1 0 15 3', color, 4.5) + `<path d="M8 -1l14 0-7 9z" fill="${color}" transform="rotate(-40 15 3)"/>`;

const ICONS: Record<string, string> = {
  // Magic Immersion: a mana drop, swirling.
  magicSurge: at(32, 32, 1.25, DROP('#5c7cff') + `<path d="M-6 0a6 6 0 1 1 6 6" fill="none" stroke="#c9d6ff" stroke-width="2.4"/>`),
  // Breath of Berserk: a heart on a gust of wind (lifesteal for all).
  breathOfTheWild: at(36, 34, 1.05, HEART) + line('M4 16h18M2 26h14M6 36h12', '#bfe8d0', 3),
  // Premium Client: a diamond with a free refresh.
  premiumClient: at(28, 32, 1.2, GEM()) + at(50, 50, 0.55, `<circle r="16" fill="#2a3a4a"/>` + LOOP('#7fe0a0')),
  // Payday: a stack of coins.
  payday:
    `<ellipse cx="32" cy="50" rx="20" ry="7" fill="#c99a10"/><rect x="12" y="42" width="40" height="8" fill="#e0b020"/><ellipse cx="32" cy="42" rx="20" ry="7" fill="#ffd23f"/>` +
    `<ellipse cx="32" cy="34" rx="20" ry="7" fill="#c99a10"/><rect x="12" y="26" width="40" height="8" fill="#e0b020"/><ellipse cx="32" cy="26" rx="20" ry="7" fill="#ffd23f"/>` +
    `<ellipse cx="32" cy="18" rx="20" ry="7" fill="#c99a10"/><rect x="12" y="10" width="40" height="8" fill="#e0b020"/><ellipse cx="32" cy="10" rx="20" ry="7" fill="#ffe680"/>`,
  // Full Throttle: a gauge, needle pinned right (levelling faster).
  fastGrowth:
    `<path d="M6 44a26 26 0 0 1 52 0z" fill="#2f3a4a"/><path d="M12 44a20 20 0 0 1 40 0" fill="none" stroke="#3fae5a" stroke-width="5"/>` +
    `<path d="M44 26a20 20 0 0 1 8 18" fill="none" stroke="#e0475e" stroke-width="5"/>` +
    line('M32 44L48 30', '#ffd23f', 3.5) + `<circle cx="32" cy="44" r="5" fill="#ffd23f"/><rect x="6" y="44" width="52" height="6" rx="2" fill="#2f3a4a"/>`,
  // Rising Fury: a red flame with a rising arrow.
  berserk: at(28, 34, 1.2, FLAME('#e0394c', '#ff8a3d')) + at(50, 22, 0.55, ARROW_UP('#ffd23f')),
  // Meltdown Armor: an armour plate bursting.
  kamikaze: `<polygon points="${burst(32, 32, 10, 30, 16)}" fill="#ff8a3d"/><polygon points="${burst(32, 32, 10, 19, 10)}" fill="#ffd23f"/>` + at(32, 33, 0.55, SHIELD('#7a8194', '#a0a8b8')),
  // Dimensional Shoot: a target, an arrow in its heart.
  sharpshooter:
    `<circle cx="28" cy="36" r="22" fill="#ffffff"/><circle cx="28" cy="36" r="15" fill="#e0394c"/><circle cx="28" cy="36" r="8" fill="#ffffff"/><circle cx="28" cy="36" r="3" fill="#e0394c"/>` +
    line('M28 36L56 8', '#6b3b1f', 3) + `<path d="M52 4l8 0-4 4 0 8-4-4z" fill="#3fae5a"/>`,
  // Uncertain Fortune: a die.
  feelingLucky:
    `<path d="M32 6l24 11-24 11L8 17z" fill="#ffffff"/><path d="M8 17l24 11v28L8 45z" fill="#dcdcea"/><path d="M56 17L32 28v28l24-11z" fill="#b8b8cc"/>` +
    `<ellipse cx="32" cy="17" rx="3.5" ry="2" fill="#e0394c" stroke="none"/>` +
    `<circle cx="15" cy="30" r="2.6" fill="#2a2032" stroke="none"/><circle cx="25" cy="44" r="2.6" fill="#2a2032" stroke="none"/>` +
    `<circle cx="39" cy="34" r="2.6" fill="#2a2032" stroke="none"/><circle cx="44" cy="38" r="2.6" fill="#2a2032" stroke="none"/><circle cx="49" cy="42" r="2.6" fill="#2a2032" stroke="none"/>`,
  // Healing Fountain: a basin, water arcing, a green cross.
  healingFountain:
    line('M32 30C32 14 18 12 14 26', '#7fd0ff', 3) + line('M32 30C32 14 46 12 50 26', '#7fd0ff', 3) +
    `<path d="M8 38h48c0 10-10 18-24 18S8 48 8 38z" fill="#9aa2b2"/><ellipse cx="32" cy="38" rx="24" ry="5" fill="#5fc0ff"/><rect x="28" y="24" width="8" height="14" fill="#b8c0d0"/>` +
    `<path d="M28 4h8v6h6v8h-6v6h-8v-6h-6v-8h6z" fill="#3fae5a"/>`,
  // Rock Solid: a stone shield.
  paladin: at(32, 32, 1.3, SHIELD('#8a8f9e', '#b8bcc8') + `<path d="M-4 -12l3 8-5 5 4 9" fill="none" stroke="#4a4e5a" stroke-width="1.8"/>`),
  // Glittering Jewels: a heap of gems.
  shoppingSpree: at(18, 42, 0.65, GEM('#ff6fa8', '#d04080')) + at(46, 42, 0.65, GEM('#7fe0a0', '#3fae5a')) + at(32, 26, 0.8, GEM()) + `<polygon points="${burst(52, 12, 4, 7, 2)}" fill="#ffffff"/>`,
  // Solid Front: a brick wall.
  solidFront:
    `<rect x="6" y="14" width="52" height="40" fill="#b0503a"/>` +
    `<path d="M6 27h52M6 41h52M20 14v13M38 14v13M54 14v13M12 27v14M30 27v14M46 27v14M20 41v13M38 41v13" stroke="${OUTLINE}" stroke-width="2"/>` +
    `<path d="M8 16h10M22 16h14" stroke="#e08a70" stroke-width="2"/>`,
  // Frontier Blitz: the two edge columns, arrows bursting out of them.
  frontierBlitz:
    `<rect x="4" y="8" width="10" height="48" rx="2" fill="#e0a63a"/><rect x="50" y="8" width="10" height="48" rx="2" fill="#e0a63a"/>` +
    line('M20 32H44', '#ffd23f', 5) + `<path d="M16 32l9-8v16z" fill="#ffd23f"/><path d="M48 32l-9-8v16z" fill="#ffd23f"/>`,
  // Barrier's Seal: a green-and-gold sealed shield.
  barriersSeal: at(32, 32, 1.3, SHIELD('#3fae5a', '#ffd23f') + `<path d="M0 -12L9 -4V8L0 13-9 8V-4z" fill="#ffd23f"/>`),
  // Mana Sovereign: a crowned blue diamond.
  manaSovereign:
    `<path d="M32 18l18 20-18 20-18-20z" fill="#4a9ff5"/><path d="M32 18l18 20H14z" fill="#7fc0ff"/>` +
    `<path d="M16 16l5-12 6 8 5-10 5 10 6-8 5 12z" fill="#ffd23f"/>`,
  // Ethereal Essence: wings around a mana drop.
  angelsBlessing:
    `<path d="M28 34C20 20 8 20 3 28c4 1 5 4 3 7 5 0 8 3 7 6 6 0 13-2 15-7z" fill="#ffffff"/>` +
    `<path d="M28 34C20 20 8 20 3 28c4 1 5 4 3 7 5 0 8 3 7 6 6 0 13-2 15-7z" fill="#ffffff" ${MIRROR_X}/>` +
    at(32, 34, 0.75, DROP('#8a7cff')),
  // All-Around Warrior: a flexed arm.
  sturdyWarrior:
    `<path d="M10 56C6 40 10 28 20 24l2-12c2-6 12-7 14-1l-2 12c10-2 20 4 20 16 0 12-10 18-22 18z" fill="#f0b088"/>` +
    `<path d="M22 12c3-2 8-2 12 0" fill="none" stroke="#c07850" stroke-width="2"/><path d="M30 34c6-4 14-2 16 4" fill="none" stroke="#c07850" stroke-width="2"/>`,
  // Elite Team: a winged boot (speed for the cheap heroes).
  eliteTeam:
    `<path d="M14 8h16v26l16 6c6 2 8 8 6 14H10z" fill="#3a84d6"/><rect x="10" y="50" width="44" height="6" rx="2" fill="#2a2032"/>` +
    `<path d="M14 18C6 14 2 18 2 18c4 2 6 4 6 4-4 0-6 3-6 3 5 1 8 2 12 0z" fill="#ffffff"/>`,
  // Peerless Valor: a crown with speed streaks.
  peerlessValor:
    line('M2 26h10M2 36h14M2 46h10', '#ffe680', 2.5) +
    `<path d="M18 48l-4-30 12 12 8-18 8 18 12-12-4 30z" fill="#ffd23f"/><rect x="18" y="46" width="34" height="8" rx="2" fill="#e0a020"/>` +
    `<circle cx="35" cy="38" r="3.5" fill="#e0394c"/>`,
  // Pas de Deux: two matching heroes, side by side.
  pasDeDeux: at(20, 36, 1.05, PAWN('#ff6fa8')) + at(44, 36, 1.05, PAWN('#ff6fa8')) + `<path d="M32 10c-3-3-7-1-6 2 1 3 6 6 6 6s5-3 6-6c1-3-3-5-6-2z" fill="#ffffff"/>`,
  // Fully Loaded: a bulging backpack.
  fullyLoaded: at(32, 34, 1.25, BACKPACK('#a86a3a')) + `<path d="M24 22l3-10M32 20V8M40 22l-3-10" stroke="#dfe6f0" stroke-width="3"/>`,
  // Purest Power: six linked nodes (a 6-trait synergy).
  teamwork: (() => {
    const pts = Array.from({ length: 6 }, (_, i) => [32 + 22 * Math.cos((Math.PI / 3) * i - Math.PI / 2), 32 + 22 * Math.sin((Math.PI / 3) * i - Math.PI / 2)].map((n) => +n.toFixed(1)));
    return `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="#3a2a5a"/>` +
      `<polygon points="${burst(32, 32, 6, 12, 7)}" fill="#c38bff"/>` +
      pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#ffd23f"/>`).join('');
  })(),
  // Excellent Recruit: a medal on a ribbon.
  excellentRecruit:
    `<path d="M20 4h10l6 22h-10zM44 4H34l-6 22h10z" fill="#3a84d6"/><path d="M27 4h3l6 22h-3z" fill="#e0394c" stroke="none"/>` +
    `<circle cx="32" cy="42" r="17" fill="#ffd23f"/><polygon points="${burst(32, 42, 5, 11, 5)}" fill="#e0a020"/>`,
  // Cyclical Support: a chest with a loop arrow (another every few rounds).
  cyclicalSupport: at(30, 38, 1.1, CHEST) + at(50, 16, 0.55, `<circle r="16" fill="#2a3a4a"/>` + LOOP('#7fe0a0')),
  // Jump the Gun: fast forward.
  jumpTheGun: `<path d="M6 12l26 20-26 20z" fill="#7fe0a0"/><path d="M32 12l26 20-26 20z" fill="#3fae5a"/>`,
  // Dark Blade: a shadowy dagger, a broken cross (cut healing).
  darkBlade:
    at(26, 34, 1.1, `<g transform="rotate(35)">${SWORD.replace('#dfe6f0', '#7a5aa8').replace('#9aa6b8', '#c38bff')}</g>`) +
    `<path d="M44 6h8v8h8v8h-8v2l-4-4 4-4h-4v-6l-4 4z" fill="#3fae5a"/>` + line('M42 26L58 6', '#e0394c', 2.5),
  // Rogue's Aid: the Thief Tool.
  roguesAid: item('thieftool'),
  // Customize Recruitment: a clipboard checklist.
  customizeRecruitment:
    `<rect x="12" y="8" width="40" height="50" rx="4" fill="#c09060"/><rect x="16" y="14" width="32" height="40" fill="#ffffff"/>` +
    `<rect x="24" y="4" width="16" height="9" rx="2" fill="#7a8194"/>` +
    `<path d="M20 24l3 3 5-6M20 34l3 3 5-6M20 44l3 3 5-6" fill="none" stroke="#3fae5a" stroke-width="2.4"/>` +
    `<path d="M32 25h12M32 35h12M32 45h8" stroke="#9aa0b2" stroke-width="2.4"/>`,
  // Fateful Dice: a hero and its mirror copy.
  fatefulDice:
    `<rect x="30.5" y="4" width="3" height="56" rx="1.5" fill="#bfe6ff"/>` + at(16, 36, 1, PAWN('#5fd0ff')) + `<g opacity="0.6">${at(48, 36, 1, PAWN('#5fd0ff'))}</g>`,
  // Counter Action: a cracked heart, chests in answer.
  counterAction: at(40, 40, 0.95, CHEST) + at(20, 22, 0.75, HEART + `<path d="M0 -6l-4 7 5 3-3 8" fill="none" stroke="${OUTLINE}" stroke-width="2"/>`),
  // Apex Weaponry: two crossed swords.
  apexWeaponry: at(32, 32, 1.15, `<g transform="rotate(-40)">${SWORD}</g><g transform="rotate(40)">${SWORD}</g>`),
  // Reinforcement Plus: a hero with two stars.
  reinforcementPlus: at(32, 40, 1.05, PAWN('#3a84d6')) + `<polygon points="${burst(20, 12, 5, 9, 4)}" fill="#ffd23f"/><polygon points="${burst(44, 12, 5, 9, 4)}" fill="#ffd23f"/>`,
  // Fast Promotion: double up chevrons.
  fastPromotion: `<path d="M8 36L32 12l24 24H42L32 26 22 36z" fill="#ffd23f"/><path d="M8 58L32 34l24 24H42L32 48 22 58z" fill="#e0a020"/>`,
  // Valor's Embrace: a shield, from the Dragon Altar.
  valorsEmbrace: at(28, 30, 1.15, SHIELD('#c38bff', '#f2beff')) + badge('dragonaltar'),
  // Fortified Defense: a castle.
  fortifiedDefense: at(32, 36, 1.3, CASTLE) + `<path d="M32 9V2l9 3-9 3" fill="#e0394c"/>`,
  // Vanguard Leader: a red banner.
  vanguardLeader: line('M16 6V60', '#8a5530', 4) + `<path d="M18 8h36l-8 12 8 12H18z" fill="#e0394c"/><path d="M26 16l4 4 6-8" fill="none" stroke="#ffd23f" stroke-width="2.6"/>`,
  // Rogue Mercenary: a blade for hire.
  rogueMercenary: at(24, 30, 1.15, `<g transform="rotate(-30)">${SWORD}</g>`) + at(46, 46, 0.6, COIN),
  // Forbidden Power: a cursed skull.
  forbiddenPower: `<polygon points="${burst(32, 32, 8, 30, 20)}" fill="#6a2fa0"/>` + at(32, 32, 1.05, SKULL),
  // Legacy of Valor: a scroll and a faction orb.
  legacyOfValor: at(28, 32, 1.1, SCROLL) + `<circle cx="48" cy="46" r="11" fill="#c38bff"/><path d="M44 42a5 5 0 0 1 5-3" fill="none" stroke="#ffffff" stroke-width="2"/>`,
  // Adequate Stock: a cardboard box.
  adequateStock:
    `<path d="M32 8l24 10-24 10L8 18z" fill="#e0b070"/><path d="M8 18l24 10v28L8 46z" fill="#c09050"/><path d="M56 18L32 28v28l24-10z" fill="#a07838"/>` +
    `<path d="M20 13l24 10v8" fill="none" stroke="#f4d8a0" stroke-width="3"/>`,
  // Trust Fund: a bank.
  trustFund:
    `<path d="M32 4L58 18H6z" fill="#d8d8e4"/><rect x="6" y="18" width="52" height="5" fill="#b8b8c8"/>` +
    `<rect x="11" y="25" width="7" height="22" fill="#e8e8f0"/><rect x="23" y="25" width="7" height="22" fill="#e8e8f0"/><rect x="34" y="25" width="7" height="22" fill="#e8e8f0"/><rect x="46" y="25" width="7" height="22" fill="#e8e8f0"/>` +
    `<rect x="4" y="48" width="56" height="8" rx="1" fill="#b8b8c8"/><circle cx="32" cy="13" r="3" fill="#ffd23f"/>`,
  // Astral Judgement: a bolt from a falling star.
  astralJudgement: `<polygon points="${burst(22, 16, 5, 13, 6)}" fill="#ffe680"/>` + at(34, 38, 1, `<path d="M4 -20L-12 4H0L-4 20L12 -4H0z" fill="#ffd23f"/>`) + badge('astral'),
  // Crushing Claw: a great talon.
  crushingClaw:
    `<path d="M14 6c-4 12 0 22 10 26L20 40c-10-6-14-20-6-34z" fill="#f0e6d0"/><path d="M30 4c-3 12 1 22 8 26l-4 8c-8-6-10-20-4-34z" fill="#f0e6d0"/>` +
    `<path d="M10 40c10 4 22 4 32-2l2 8c-12 8-26 8-36 2z" fill="#e0a020"/>` + badge('skybringer'),
  // Emergency Rift: a tear into the grave's world.
  emergencyRift:
    `<path d="M30 4c-8 10 6 14-4 26s8 16 2 30c14-8 2-16 12-28S30 16 30 4z" fill="#2a0f3a"/>` +
    `<path d="M30 12c-4 6 4 10-2 18s6 12 2 20c8-6 0-12 6-20s-8-12-6-18z" fill="#6a2fa0" stroke="none"/>` + badge('necromancer'),
  // Exclusive Offering: a second sacred flame.
  exclusiveOffering: at(20, 34, 0.9, FLAME('#c0283a', '#ff8a3d')) + at(38, 28, 1.05, FLAME()) + badge('cultoffire'),
  // Gustiwana Unbound: an open padlock.
  gustiwanaUnbound:
    line('M18 26V16a10 10 0 0 1 20 0', '#b8bcc8', 5) +
    `<rect x="10" y="26" width="34" height="28" rx="4" fill="#d9a441"/><circle cx="27" cy="38" r="4" fill="#5c1629"/><rect x="25.5" y="40" width="3" height="7" fill="#5c1629"/>` + badge('gustiwana'),
  // The item cards: the item itself, sparkling (enhanced).
  manicSlam: item('goldenstaff') + sparkle(),
  howlingWind: item('wintercrown') + sparkle(),
  totalDomination: item('dominanceice') + sparkle(),
  brightSunshine: item('oracle') + sparkle(),
  bloodClaw: item('haasclaw') + sparkle(),
  talismanUnleashed: item('spellbladetalisman') + sparkle(),
  gloriousRogue: item('thieftool', 2, 6, 54) + sparkle() + `<polygon points="${burst(12, 52, 4, 7, 2)}" fill="#ffd23f"/>`,
  // Neon Zenith: a city at night, neon lit.
  neonZenith:
    `<circle cx="48" cy="14" r="8" fill="#ffe680"/><circle cx="52" cy="11" r="7" fill="#1d1a3a" stroke="none"/>` +
    `<path d="M4 58V30h10v-8h8v36zM24 58V18h12v40zM38 58V34h8v-6h10v30z" fill="#2f2a58"/>` +
    `<path d="M8 36h4M8 44h4M28 24h4M28 32h4M28 40h4M42 40h4M50 34h3M50 42h3" stroke="#ff4fd8" stroke-width="2.2"/>` +
    `<path d="M4 58h56" stroke="#3cb8ff" stroke-width="3"/>`,
  // Transmutation: an alchemist's flask.
  transmutation:
    `<path d="M24 6h16v4h-3v14l15 24c3 5 0 10-6 10H18c-6 0-9-5-6-10l15-24V10h-3z" fill="#e8f4ff"/>` +
    `<path d="M17 42h30l5 7c2 4 0 7-4 7H16c-4 0-6-3-4-7z" fill="#3fae5a"/>` +
    `<circle cx="28" cy="48" r="2.5" fill="#bfffd0" stroke="none"/><circle cx="36" cy="44" r="1.8" fill="#bfffd0" stroke="none"/><circle cx="34" cy="34" r="2" fill="#bfffd0" stroke="none"/>`,
  // KO Punch: a red glove, the target seeing stars.
  koPunch:
    `<path d="M10 32c0-14 10-20 20-20 11 0 17 8 17 18 0 7-4 12-8 14v8H18v-8c-5-3-8-7-8-12z" fill="#e0394c"/>` +
    `<path d="M10 32c-2 7 2 12 9 12 4 0 6-3 6-6-5 0-8-2-10-6z" fill="#b0202e"/><rect x="18" y="50" width="22" height="7" rx="2" fill="#ffffff"/>` +
    `<polygon points="${burst(52, 10, 5, 7, 3)}" fill="#ffd23f"/>` + badge('fighter', 50, 50, 11),
  // Aftershock: an erupting volcano.
  aftershock:
    `<path d="M2 58l18-30h20l18 30z" fill="#6b4a3a"/><path d="M20 28l4 8 4-4 4 6 4-6 4 4z" fill="#ff8a3d"/>` +
    `<path d="M26 26c-4-8 0-16 6-20 0 6 6 8 4 14z" fill="#ff8a3d"/>` + badge('defender', 50, 50, 11),
  // Blazing Valor: a shield wreathed in a blazing sun.
  blazingValor: `<polygon points="${burst(30, 30, 12, 28, 18)}" fill="#ffd23f"/>` + at(30, 30, 0.9, SHIELD('#ff8a3d', '#ffe680')) + badge('dauntless'),
  // Whirl of Carnage: a whirlwind.
  whirlOfCarnage: line('M8 10h44', '#c8d2e2', 5) + line('M14 22h34', '#c8d2e2', 5) + line('M20 34h22', '#c8d2e2', 5) + line('M26 46h12', '#c8d2e2', 5) + line('M30 56h4', '#c8d2e2', 4) + badge('weaponmaster'),
  // Hail of Shots: a volley of arrows coming down.
  hailOfShots:
    [10, 26, 42].map((x, i) => line(`M${x} ${4 + i * 3}L${x + 8} ${34 + i * 3}`, '#dfe6f0', 2.6) + `<path d="M${x + 8} ${36 + i * 3}l-6-6 9-2z" fill="#3cb8ff"/>`).join('') + badge('deadeye'),
  // Star Chorus: music notes under a star.
  starChorus:
    `<path d="M16 12l24-6v34" fill="none" stroke="${OUTLINE}" stroke-width="6"/><path d="M16 12l24-6v34" fill="none" stroke="#bc98ff" stroke-width="3"/>` +
    line('M16 12v32', '#bc98ff', 3) + `<ellipse cx="11" cy="45" rx="7" ry="5" fill="#bc98ff"/><ellipse cx="35" cy="41" rx="7" ry="5" fill="#bc98ff"/>` + badge('stargazer'),
  // Cutthroat: a hunter's knife.
  cutthroat:
    `<path d="M8 14C26 10 42 18 48 30L30 38C26 28 18 20 8 14z" fill="#dfe6f0"/><path d="M14 16C26 15 36 20 42 28" fill="none" stroke="#9aa6b8" stroke-width="1.6"/>` +
    `<path d="M28 38l20-8 3 6-20 8z" fill="#6b3b1f"/>` + badge('hunter'),
  // Critical Spellcraft: a spell going critical.
  criticalSpellcraft: `<polygon points="${burst(30, 30, 8, 28, 10)}" fill="#3cb8ff"/><polygon points="${burst(30, 30, 8, 15, 6)}" fill="#ffffff"/>` + badge('mage'),
  // Prime Selection: three orbs, one picked.
  factionSynergy:
    `<circle cx="14" cy="40" r="10" fill="#e0475e"/><circle cx="50" cy="40" r="10" fill="#3fae5a"/>` +
    `<circle cx="32" cy="28" r="14" fill="#3a84d6"/><path d="M25 22a7 7 0 0 1 7-4" fill="none" stroke="#ffffff" stroke-width="2.5"/>` +
    `<path d="M26 50l6 8 6-8z" fill="#ffd23f"/>`,
  // Ally's Call: a horn.
  allysCall:
    `<path d="M6 34c10-2 24-12 32-24l6 4c-2 16 2 30 10 38l-6 4C38 46 22 40 8 44z" fill="#e0a020"/>` +
    `<ellipse cx="51" cy="33" rx="4" ry="21" fill="#ffd23f" transform="rotate(-24 51 33)"/><rect x="2" y="34" width="8" height="10" rx="2" fill="#8a5530"/>`,
  // The item bundles: their three items.
  theHunt: item('goldenstaff', 0, 4, 40) + item('seahalberd', 24, 4, 40) + item('demonhuntersword', 12, 24, 40),
  holyObjects: item('glowingwand', 0, 4, 40) + item('icequeenwand', 24, 4, 40) + item('spellbladetalisman', 12, 24, 40),
  fortified: item('bladearmor', 0, 2, 38) + item('guardianhelmet', 26, 2, 38) + item('dominanceice', 13, 26, 38),
  // Fully Armed: a backpack lending out two blades.
  fullyArmed: at(24, 38, 1, BACKPACK('#3a84d6')) + at(48, 24, 0.7, `<g transform="rotate(25)">${SWORD}</g>`) + at(52, 46, 0.55, `<g transform="rotate(60)">${SWORD}</g>`),
  // Territory Agreement: a signed treaty, locked.
  territoryAgreement:
    at(28, 30, 1.1, SCROLL) +
    line('M42 44v-5a6 6 0 0 1 12 0v5', '#b8bcc8', 3) + `<rect x="38" y="44" width="20" height="15" rx="3" fill="#e0394c"/><circle cx="48" cy="51" r="2.5" fill="#2a2032"/>`,
  // Party's Opening: a party popper.
  partysOpening:
    `<path d="M6 58l12-34 22 22z" fill="#ffd23f"/><path d="M10 47l6-16M14 54l12-20" stroke="#e0394c" stroke-width="3"/>` +
    `<circle cx="34" cy="14" r="3" fill="#3cb8ff"/><circle cx="50" cy="26" r="3" fill="#ff6fa8"/><circle cx="46" cy="8" r="2.5" fill="#7fe0a0"/>` +
    `<path d="M26 10l2 6M54 40l-6 2M40 20l6-6" stroke="#ffd23f" stroke-width="3"/>`,
  // Sharp Armory: crossed smithing hammers.
  sharpArmory: at(32, 32, 1.1,
    ['-40', '40'].map((r) => `<g transform="rotate(${r})"><rect x="-2.5" y="-8" width="5" height="30" rx="2" fill="#8a5530"/><rect x="-11" y="-20" width="22" height="12" rx="2" fill="#9aa2b2"/></g>`).join('')),
  // Opening Promotion: a price tag, marked down to free.
  openingPromotion:
    `<path d="M30 6h22a4 4 0 0 1 4 4v22L28 60 4 36z" fill="#ff6fa8"/><circle cx="46" cy="16" r="4.5" fill="#2a2032"/>` +
    line('M18 40L36 22', '#ffffff', 3) + line('M24 46L42 28', '#ffffff', 3),
  // Vault Upgrade: a vault door.
  vaultUpgrade:
    `<rect x="6" y="6" width="52" height="52" rx="6" fill="#7a8194"/><circle cx="32" cy="32" r="18" fill="#b8bcc8"/><circle cx="32" cy="32" r="6" fill="#ffd23f"/>` +
    `<path d="M32 14v12M32 38v12M14 32h12M38 32h12" stroke="${OUTLINE}" stroke-width="3"/>`,
  // Golden Era: a golden sunrise.
  goldenEra:
    `<path d="M10 44a22 22 0 0 1 44 0z" fill="#ffd23f"/>` +
    `<path d="M32 8v10M10 16l7 7M54 16l-7 7M2 34h10M52 34h10" stroke="#ffd23f" stroke-width="3.5"/>` +
    `<rect x="2" y="44" width="60" height="6" rx="2" fill="#e0a020"/><rect x="10" y="52" width="44" height="5" rx="2" fill="#c08010"/>`,
  // The More the Merrier: confetti over a coin.
  moreTheMerrier:
    at(32, 40, 0.95, COIN) +
    `<rect x="8" y="6" width="5" height="9" fill="#e0394c" transform="rotate(25 10 10)"/><rect x="48" y="4" width="5" height="9" fill="#3cb8ff" transform="rotate(-30 50 8)"/>` +
    `<rect x="28" y="2" width="5" height="9" fill="#7fe0a0" transform="rotate(10 30 6)"/><circle cx="56" cy="22" r="3" fill="#ff6fa8"/><circle cx="6" cy="26" r="3" fill="#ffd23f"/>`,
  // Death Oracle: a skull inside a crystal ball.
  deathOracle: `<circle cx="32" cy="28" r="24" fill="#2a5a4a"/>` + at(32, 28, 0.72, SKULL.replace(/#2a2032/g, '#3fe0a0')) + `<path d="M12 52h40l-4 8H16z" fill="#8a5530"/><path d="M16 18a18 18 0 0 1 8-8" fill="none" stroke="#bfffe0" stroke-width="2.5"/>`,
  // Copycat: a cat face.
  copycat:
    `<path d="M10 24L8 4l16 12h16L56 4l-2 20c4 6 4 14 0 20-4 8-12 12-22 12S14 52 10 44c-4-6-4-14 0-20z" fill="#e0a050"/>` +
    `<ellipse cx="23" cy="32" rx="4" ry="5.5" fill="#3fae5a"/><ellipse cx="41" cy="32" rx="4" ry="5.5" fill="#3fae5a"/>` +
    `<path d="M29 41h6l-3 3z" fill="#e0394c"/><path d="M4 40h14M4 46h14M46 40h14M46 46h14" stroke="${OUTLINE}" stroke-width="1.6"/>`,
  // Novel Equipment: an open book, sparkling.
  novelEquipment:
    `<path d="M32 16C24 10 14 10 4 13v38c10-3 20-3 28 3 8-6 18-6 28-3V13c-10-3-20-3-28 3z" fill="#f4f0e6"/>` +
    `<path d="M32 16v38" stroke="${OUTLINE}" stroke-width="2"/><path d="M10 22c6-1 12-1 16 2M10 30c6-1 12-1 16 2M38 24c4-3 10-3 16-2M38 32c4-3 10-3 16-2" fill="none" stroke="#9aa0b2" stroke-width="2"/>` +
    sparkle(50, 10, 9),
};

// A synergy's badge worn as a medal, on its ribbons (the Badge cards).
const medal = (id: string) =>
  `<path d="M18 40l-8 20 9-3 5 7 6-20zM46 40l8 20-9-3-5 7-6-20z" fill="${hex(TRAIT_BADGES[id].color)}"/>` + badge(id, 32, 28, 22);
// Three stars over a hero's motif (the cards giving a 3★ hero).
const threeStar = (body: string) =>
  at(32, 38, 1, body) + [14, 32, 50].map((x, i) => `<polygon points="${burst(x, i === 1 ? 8 : 11, 5, 7, 3)}" fill="#ffd23f"/>`).join('');
// A commander shield over a coin, and how fast it pays out.
const fortune = (fast: boolean) =>
  at(28, 32, 1.25, SHIELD('#3a84d6')) + at(28, 32, 0.45, COIN) +
  (fast
    ? at(50, 48, 0.55, `<circle r="18" fill="#2a3a4a"/><path d="M4 -16L-10 4H0L-4 16L10 -4H0z" fill="#ffd23f"/>`)
    : at(50, 48, 0.55, `<circle r="18" fill="#2a3a4a"/><path d="M-9 -13h18l-7 13 7 13h-18l7-13z" fill="#e0c090"/>`));

const SYNERGY_CARDS = ['astral', 'gustiwana', 'skybringer', 'fighter', 'dauntless', 'defender', 'deadeye', 'necromancer', 'mage', 'hunter', 'stargazer', 'dragonaltar', 'cultoffire', 'spectre', 'weaponmaster'];

const MORE: Record<string, string> = {
  shieldOfFortuneSlow: fortune(false),
  shieldOfFortuneFast: fortune(true),
  // Glorious Claim: a trophy.
  gloriousClaim:
    `<path d="M14 10h-8c0 12 6 18 12 18M50 10h8c0 12-6 18-12 18" fill="none" stroke="${OUTLINE}" stroke-width="6"/><path d="M14 10h-8c0 12 6 18 12 18M50 10h8c0 12-6 18-12 18" fill="none" stroke="#e0a020" stroke-width="3"/>` +
    `<path d="M14 6h36v12c0 12-8 20-18 20S14 30 14 18z" fill="#ffd23f"/><rect x="28" y="37" width="8" height="10" fill="#e0a020"/>` +
    `<rect x="18" y="47" width="28" height="10" rx="2" fill="#8a5530"/><path d="M22 12v8" stroke="#fff3a0" stroke-width="3"/>`,
  // Experienced Shuffle: crossing shuffle arrows.
  experiencedShuffle:
    line('M6 18h12c12 0 16 28 28 28h6', '#7fe0a0', 4.5) + line('M6 46h12c12 0 16-28 28-28h6', '#3cb8ff', 4.5) +
    `<path d="M50 10l10 8-10 8z" fill="#3cb8ff"/><path d="M50 38l10 8-10 8z" fill="#7fe0a0"/>`,
  // Turret of Guardians: a watchtower holding a crystal.
  turretOfGuardians:
    `<path d="M20 58l4-34h16l4 34z" fill="#9aa2b2"/><path d="M16 24h32v-6h-6v4h-4v-4h-12v4h-4v-4h-6z" fill="#b8bcc8"/>` +
    `<path d="M32 2l7 9-7 9-7-9z" fill="#5fd0ff"/><path d="M28 58v-12a4 4 0 0 1 8 0v12z" fill="#3a3248"/><rect x="29" y="30" width="6" height="8" fill="#3a3248"/>`,
  // Divine Execution: the scales of justice.
  divineExecution:
    line('M32 8V54', '#e0a020', 3.5) + line('M10 16H54', '#e0a020', 3.5) +
    line('M10 16L4 34M10 16l6 18M54 16l-6 18M54 16l6 18', '#c8d2e2', 1.5) +
    `<path d="M2 34h16a8 5 0 0 1-16 0zM46 34h16a8 5 0 0 1-16 0z" fill="#ffd23f"/><rect x="20" y="52" width="24" height="6" rx="2" fill="#e0a020"/>` +
    `<circle cx="32" cy="8" r="4" fill="#ffffff"/>`,
  // Disco Fever: a mirror ball.
  discoFever:
    line('M32 2V12', '#9aa0b2', 2) + `<circle cx="32" cy="36" r="22" fill="#b8c4d8"/>` +
    `<path d="M10 36h44M14 25h36M14 47h36M32 14c-8 6-8 38 0 44M32 14c8 6 8 38 0 44M22 18c-6 8-6 28 0 36M42 18c6 8 6 28 0 36" fill="none" stroke="#6a7488" stroke-width="1.4"/>` +
    `<path d="M20 26h6v6h-6zM36 40h6v6h-6z" fill="#ffffff" stroke="none"/><polygon points="${burst(54, 12, 4, 7, 2)}" fill="#ff6fa8"/><polygon points="${burst(8, 54, 4, 6, 2)}" fill="#3cb8ff"/>`,
  // Synergy Constellation: linked stars.
  synergyConstellation:
    line('M10 46L24 20L42 30L54 10M42 30L48 52', '#8fa8ff', 2) +
    [[10, 46, 6], [24, 20, 8], [42, 30, 7], [54, 10, 6], [48, 52, 6]].map(([x, y, r]) => `<polygon points="${burst(x, y, 5, r, r * 0.45)}" fill="#ffe680"/>`).join(''),
  // The 3★ hero cards: each hero's motif, under three stars.
  quakingBlow: threeStar(`<g transform="rotate(-30)"><rect x="-3" y="-6" width="6" height="28" rx="2" fill="#8a5530"/><rect x="-14" y="-20" width="28" height="15" rx="3" fill="#9aa2b2"/></g>`) + line('M6 58l8-6M58 58l-8-6', '#ffd23f', 2.5),
  cycloneSigil: threeStar(line('M-18 -14h36', '#bfe8ff', 5) + line('M-13 -3h26', '#bfe8ff', 5) + line('M-8 8h16', '#bfe8ff', 5) + line('M-3 18h6', '#bfe8ff', 4)),
  backlineBreach: threeStar(
    `<ellipse cy="8" rx="12" ry="10" fill="#c0283a"/><ellipse cx="-14" cy="-6" rx="5" ry="7" fill="#c0283a"/><ellipse cx="-5" cy="-15" rx="5" ry="7" fill="#c0283a"/><ellipse cx="5" cy="-15" rx="5" ry="7" fill="#c0283a"/><ellipse cx="14" cy="-6" rx="5" ry="7" fill="#c0283a"/>`,
  ),
  demonicWrath: threeStar(
    `<path d="M-16 -18l8 10M16 -18l-8 10" stroke="${OUTLINE}" stroke-width="2"/><path d="M-18 -20l12 8-6 4zM18 -20l-12 8 6 4z" fill="#ffd23f"/>` +
      `<circle r="18" fill="#a02a5a"/><path d="M-10 -4l7 3M10 -4l-7 3" stroke="#ffd23f" stroke-width="3"/><path d="M-8 8c4 5 12 5 16 0" fill="none" stroke="#2a0f1a" stroke-width="2.5"/>`,
  ),
  forkedLightning: threeStar(`<path d="M2 -22L-12 0H-2L-8 22L2 6l4 16 4-26H2L10 -22z" fill="#ffd23f"/>`),
  virtuoso: threeStar(
    `<g transform="rotate(30)"><path d="M0 -6c-7 0-10 4-8 9-4 2-5 8-1 12 4 4 14 4 18 0 4-4 3-10-1-12 2-5-1-9-8-9z" fill="#a0602a"/>` +
      `<rect x="-2" y="-24" width="4" height="20" fill="#4a2a12"/><path d="M-3 2h6M-3 10h6" stroke="#2a1a08" stroke-width="1.6"/></g>` + line('M-18 14L16 -16', '#e8e8f0', 1.6),
  ),
  abyssalSmash: threeStar(`<path d="M-22 16C-16 0-6 -8 6 -6c-6 2-8 8-4 12 6-4 14 0 16 6 2 4 2 4 4 4v6h-44z" fill="#3a84d6"/><path d="M-22 16c10 2 20 0 26-6" fill="none" stroke="#bfe6ff" stroke-width="2.2"/>`),
  vengefulAegis: threeStar(`<circle r="19" fill="#3a6ad6"/><circle r="13" fill="#ffffff"/><circle r="8" fill="#5fd0ff"/><circle r="4" fill="#1d1622"/>`),
  ...Object.fromEntries(SYNERGY_CARDS.flatMap((id) => [
    [`${id}Badge`, medal(id)],
    [`${id}Blessing`, medal(id) + at(52, 52, 0.48, CHEST)],
  ])),
};

export const POWER_CARD_SVGS: Record<string, string> = Object.fromEntries(Object.entries({ ...ICONS, ...MORE }).map(([id, body]) => [id, svg(body)]));
