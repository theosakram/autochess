// Hand-drawn icons for Dracula's Demon Altar rewards (64x64), in the commander portraits' style (icons/commanders.ts):
// flat shapes with a dark outline. Keyed by AltarReward.kind (see game/demonAltar.ts).
import { burst, line, svg } from './commanders';

const coin = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f2c531"/><circle cx="${cx}" cy="${cy}" r="${r * 0.66}" fill="none" stroke="#c9a227" stroke-width="2.5"/>`;

const chest = (lid: string, body: string, band: string) =>
  `<path d="M8 30h48v24a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="${body}"/>` +
  `<path d="M8 30c0-10 8-16 24-16s24 6 24 16z" fill="${lid}"/>` +
  `<path d="M8 30h48" fill="none" stroke-width="2.5"/>` +
  `<path d="M18 16v41M46 16v41" stroke="${band}" stroke-width="4"/>` +
  `<rect x="27" y="26" width="10" height="11" rx="2" fill="#ffd23f"/>`;

const orb = (fill: string, shine: string) =>
  `<circle cx="32" cy="32" r="24" fill="${fill}"/>` +
  `<circle cx="32" cy="32" r="16" fill="none" stroke="${shine}" stroke-width="2" opacity="0.6"/>` +
  `<ellipse cx="24" cy="22" rx="7" ry="4.5" fill="#ffffff" opacity="0.75" stroke="none" transform="rotate(-30 24 22)"/>`;

export const ALTAR_REWARD_SVGS: Record<string, string> = {
  gold: svg(coin(24, 38, 15) + coin(40, 26, 15)),
  xp: svg(line('M14 34l18-18 18 18', '#5fe08a', 7) + line('M14 52l18-18 18 18', '#5fe08a', 7)),
  // Heroes: a bust in the cost's colour (the --tier-N colours in style.css), one icon per cost.
  ...Object.fromEntries(
    ['#f2f4f8', '#3fae5a', '#3a84d6', '#a457d6', '#e0a63a'].map((color, i) => [
      `hero${i + 1}`,
      svg(`<circle cx="32" cy="20" r="11" fill="#f4c46a"/><path d="M10 58c0-14 10-22 22-22s22 8 22 22z" fill="${color}"/>`),
    ]),
  ),
  star: svg(`<polygon points="${burst(32, 33, 5, 27, 11)}" fill="#ffd23f"/>`),
  chest: svg(chest('#c0703a', '#9a5226', '#5a5560')),
  enhancedChest: svg(
    chest('#9a5cf0', '#7b3fd0', '#ffd23f') + `<polygon points="${burst(52, 12, 4, 10, 3.5)}" fill="#fff3c4"/>`,
  ),
  factionOrb: svg(orb('#3a7bd5', '#bfe6ff')),
  roleOrb: svg(orb('#9a5cf0', '#e6d2ff')),
  mirror: svg(
    `<rect x="29" y="40" width="6" height="20" rx="3" fill="#5b3590"/>` +
      `<ellipse cx="32" cy="24" rx="17" ry="20" fill="#8a55c9"/>` +
      `<ellipse cx="32" cy="24" rx="12" ry="15" fill="#bfe6ff"/>` +
      `<path d="M24 20l7-7M24 27l12-12" stroke="#ffffff" stroke-width="3"/>`,
  ),
};
