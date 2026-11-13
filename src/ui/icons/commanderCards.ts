// Hand-drawn commander card icons (64x64), replacing the cards' emoji, in the same style as the commander
// portraits (icons/commanders.ts): flat shapes with a dark outline, readable at small sizes.
// The card's emoji (CommanderDef.card.icon) stays as the fallback for anyone not here.
import { burst, line, MIRROR_X, svg } from './commanders';

export const COMMANDER_CARD_SVGS: Record<string, string> = {
  // Lukas, Vanguard Beast: a golden burst torn by three claw marks.
  lukas: svg(
    `<polygon points="${burst(32, 32, 8, 29, 16)}" fill="#ffd23f"/>` +
      `<circle cx="32" cy="32" r="13" fill="#ffb020"/>` +
      line('M21 20l7 24', '#8a1f2b', 4) +
      line('M31 17l5 28', '#8a1f2b', 4) +
      line('M41 20l3 23', '#8a1f2b', 4),
  ),
  // Kagura, Umbrella Dance: an open paper umbrella.
  kagura: svg(
    line('M32 30v20a5 5 0 0 1-10 0', '#6b3b1f', 3) +
      `<path d="M5 32a27 23 0 0 1 54 0c-4.5-3.5-9-3.5-13.5 0-4.5-3.5-9-3.5-13.5 0-4.5-3.5-9-3.5-13.5 0-4.5-3.5-9-3.5-13.5 0z" fill="#e8476a"/>` +
      `<path d="M32 9c-6 6-8 14-6.5 23M32 9c6 6 8 14 6.5 23" fill="none" stroke="#b02a4a" stroke-width="1.6"/>` +
      `<circle cx="32" cy="8" r="2.5" fill="#ffd23f"/>`,
  ),
  // Angela, Choir of Wings: two wings on a beam of light, a halo above.
  angela: svg(
    `<rect x="3" y="33" width="58" height="7" rx="3.5" fill="#ff9fc4"/>` +
      `<path d="M30 36C22 22 10 22 5 30c4 1 5 4 3 7 5 0 8 3 7 6 6 0 13-2 15-7z" fill="#ffffff"/>` +
      `<path d="M30 36C22 22 10 22 5 30c4 1 5 4 3 7 5 0 8 3 7 6 6 0 13-2 15-7z" fill="#ffffff" ${MIRROR_X}/>` +
      line('M22 12a10 3.5 0 1 0 20 0a10 3.5 0 1 0-20 0', '#ffd23f', 3),
  ),
  // Kenzo, Black Sash: a black belt's knot with gold-tipped tails.
  kenzo: svg(
    `<rect x="4" y="22" width="56" height="12" rx="3" fill="#2f2f3a"/>` +
      `<path d="M28 34l-8 22 7-1 5-15z" fill="#2f2f3a"/><path d="M36 34l8 22-7-1-5-15z" fill="#2f2f3a"/>` +
      `<path d="M21 52l7-1-1 4-7 1z" fill="#e0a63a"/><path d="M43 52l-7-1 1 4 7 1z" fill="#e0a63a"/>` +
      `<rect x="25" y="18" width="14" height="20" rx="4" fill="#45455a"/>` +
      `<path d="M28 24h8M28 30h8" stroke="#e0a63a" stroke-width="1.6"/>`,
  ),
  // Nana, Leaf Disguise: one big leaf.
  nana: svg(
    `<path d="M9 55C7 30 24 9 55 8c2 29-17 47-46 47z" fill="#4caf50"/>` +
      line('M11 53C24 40 34 28 48 15', '#2e7d32', 2.5) +
      `<path d="M24 40l-2-12M31 32l-1-12M38 25l0-9M24 40l12 1M31 32l12 0M38 25l9-1" fill="none" stroke="#2e7d32" stroke-width="1.8"/>`,
  ),
  // Kaela, Lucky Streak: a four-leaf clover.
  kaela: svg(
    line('M36 40Q44 52 52 58', '#2e7d32', 3) +
      `<circle cx="23" cy="23" r="11" fill="#3fae5a"/><circle cx="41" cy="23" r="11" fill="#3fae5a"/>` +
      `<circle cx="23" cy="41" r="11" fill="#3fae5a"/><circle cx="41" cy="41" r="11" fill="#3fae5a"/>` +
      `<circle cx="32" cy="32" r="5" fill="#2e7d32"/>` +
      `<path d="M19 19l4 4M45 19l-4 4" stroke="#8fe0a0" stroke-width="2"/>`,
  ),
  // Ruby, Hunter's Bounty: a fat bag of gold.
  ruby: svg(
    `<path d="M24 14h16l-4 8c10 4 16 14 16 22 0 8-8 12-20 12s-20-4-20-12c0-8 6-18 16-22z" fill="#d9b25a"/>` +
      `<rect x="23" y="19" width="18" height="5" rx="2" fill="#8a6a2a"/>` +
      `<path d="M38 34c-2-3-11-3-11 1.5s11 2.5 11 7-9 5-12 1M32 30v20" fill="none" stroke="#4a3a10" stroke-width="2.6"/>`,
  ),
  // Dyroth, Abyss Altar: a swirling void over a stone altar.
  dyroth: svg(
    `<path d="M14 46h36l4 12H10z" fill="#6b6170"/>` +
      `<rect x="11" y="40" width="42" height="7" rx="2" fill="#8a8090"/>` +
      `<ellipse cx="32" cy="22" rx="19" ry="16" fill="#2a0f3a"/>` +
      `<ellipse cx="32" cy="22" rx="13" ry="10.5" fill="#6a2fa0"/>` +
      `<ellipse cx="32" cy="22" rx="6" ry="5" fill="#0b0410"/>` +
      `<path d="M20 20c3-6 12-8 18-4M44 25c-3 6-12 8-18 4" fill="none" stroke="#c38bff" stroke-width="1.8"/>`,
  ),
  // Lunox, Eclipse: a dark moon over the sun, its corona blazing.
  lunox: svg(
    `<polygon points="${burst(32, 32, 12, 29, 20)}" fill="#ffd23f"/>` +
      `<circle cx="32" cy="32" r="19" fill="#ffb020"/>` +
      `<circle cx="35" cy="30" r="17" fill="#241e48"/>` +
      `<circle cx="29" cy="26" r="2" fill="#4a3f88" stroke="none"/><circle cx="40" cy="36" r="3" fill="#4a3f88" stroke="none"/>`,
  ),
  // Miya, Ice Longbow: a frost-blue bow with an arrow nocked.
  miya: svg(
    line('M18 6V58', '#e6fbff', 1.5) +
      line('M18 6C42 16 42 48 18 58', '#7ad7ff', 5) +
      line('M8 32H52', '#cfefff', 2.5) +
      `<path d="M58 32l-9-5v10z" fill="#a9ecff"/>` +
      `<path d="M8 32l-4-5h5l4 5-4 5H4z" fill="#ffffff"/>`,
  ),
  // Alice, Blood Feast: a goblet of red wine.
  alice: svg(
    `<ellipse cx="32" cy="53" rx="13" ry="4.5" fill="#cfcfdc"/>` +
      `<rect x="29.5" y="30" width="5" height="22" fill="#cfcfdc"/>` +
      `<path d="M16 8h32c0 15-7 24-16 24S16 23 16 8z" fill="#ececf4"/>` +
      `<path d="M19 13h26c-1 10-6 15.5-13 15.5S20 23 19 13z" fill="#b0102a"/>` +
      `<path d="M23 16c1 4 3 7 6 8" fill="none" stroke="#e04060" stroke-width="2"/>`,
  ),
  // Luo Yi, Earthen Echo: snow-capped peaks, an echo ringing off them.
  luoyi: svg(
    `<path d="M3 56L21 22l9 13 9-21 22 42z" fill="#8a7a64"/>` +
      `<path d="M39 14l-6 12 4-2 2 3 3-3 3 2z" fill="#ffffff"/>` +
      `<path d="M21 22l-5 9 3-1 2 2 2-2 3 1z" fill="#ffffff"/>` +
      line('M48 10a8 8 0 0 1 7 8', '#bfe0ff', 2.2) +
      line('M50 3a15 15 0 0 1 12 14', '#bfe0ff', 2.2),
  ),
  // Johnson, Family Business: a leather briefcase.
  johnson: svg(
    line('M24 22v-6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6', '#5a3418', 3.5) +
      `<rect x="7" y="22" width="50" height="32" rx="4" fill="#8a5530"/>` +
      `<rect x="7" y="34" width="50" height="4" fill="#5a3418"/>` +
      `<rect x="27" y="31" width="10" height="10" rx="2" fill="#e0a63a"/>`,
  ),
  // Amon, Polished Reflection: a cut gem, gleaming.
  amon: svg(
    `<path d="M14 23l9-11h18l9 11-18 31z" fill="#5fd0ff"/>` +
      `<path d="M14 23h36L32 54z" fill="#3aa8e0"/>` +
      `<path d="M23 12l-2 11 11 31 11-31-2-11M21 23l11-11 11 11" fill="none" stroke-width="1.5"/>` +
      `<path d="M26 16l3-2" stroke="#ffffff" stroke-width="3"/>` +
      `<polygon points="${burst(52, 10, 4, 6, 1.6)}" fill="#ffffff" stroke="none"/>`,
  ),
  // Freya, Harvest Blessing: a wrapped gift with a gold bow.
  freya: svg(
    `<rect x="10" y="29" width="44" height="26" rx="2" fill="#e8476a"/>` +
      `<rect x="7" y="21" width="50" height="10" rx="2" fill="#ff6f8e"/>` +
      `<rect x="29" y="21" width="6" height="34" fill="#ffd23f"/>` +
      `<path d="M32 21c-4-11-17-11-15-3 1 4 9 4 15 3z" fill="#ffd23f"/>` +
      `<path d="M32 21c-4-11-17-11-15-3 1 4 9 4 15 3z" fill="#ffd23f" ${MIRROR_X}/>`,
  ),
  // Cyclops, Carrion Feast: a hunk of meat on the bone.
  cyclops: svg(
    line('M38 38L52 52', '#f0e6d0', 6) +
      `<circle cx="55" cy="49" r="4.5" fill="#f0e6d0"/><circle cx="49" cy="55" r="4.5" fill="#f0e6d0"/>` +
      `<path d="M9 30c0-13 11-21 24-19 11 2 15 13 11 23-3 9-13 13-22 11-9-2-13-8-13-15z" fill="#c0503a"/>` +
      `<ellipse cx="27" cy="28" rx="9" ry="7" fill="#e88a70"/>` +
      `<ellipse cx="27" cy="28" rx="4" ry="3" fill="#f4c0a8" stroke="none"/>`,
  ),
  // Guiness, On the House: a ticket with a star.
  guiness: svg(
    `<path d="M5 20h54v8a4 4 0 0 0 0 8v8H5v-8a4 4 0 0 0 0-8z" fill="#ffb347"/>` +
      `<path d="M43 22v20" fill="none" stroke="#a0601a" stroke-width="2" stroke-dasharray="3 3"/>` +
      `<polygon points="${burst(25, 32, 5, 9, 4)}" fill="#fff3c4"/>` +
      `<circle cx="51" cy="32" r="3" fill="#fff3c4"/>`,
  ),
  // Minos, Labyrinth Forge: an anvil under a forge flame.
  minos: svg(
    `<path d="M32 26c-8-4-8-12 0-20 0 6 5 7 7 3 5 6 4 14-2 17z" fill="#ff8a3d"/>` +
      `<path d="M33 24c-3-2-3-6 0-9 1 3 3 3 4 2 1 3 0 6-2 7z" fill="#ffd23f"/>` +
      `<path d="M6 28h40c0 5 5 7 12 7v4H46c-2 5-6 8-6 8h4v8H20v-8h4s-4-3-6-8c-7 0-12-4-12-11z" fill="#7a8194"/>` +
      `<path d="M10 31h34" stroke="#b0b8c8" stroke-width="2"/>`,
  ),
  // Katarina, Death Lotus: a pink lotus, a blade through it.
  katarina: svg(
    line('M52 6L38 30', '#dfe6f0', 3.5) +
      `<path d="M14 22c11 2 17 11 18 21-11 0-18-9-18-21z" fill="#ff6fa8"/>` +
      `<path d="M14 22c11 2 17 11 18 21-11 0-18-9-18-21z" fill="#ff6fa8" ${MIRROR_X}/>` +
      `<path d="M32 10c7 9 8 20 0 33-8-13-7-24 0-33z" fill="#ffa0cc"/>` +
      `<path d="M7 42c9 8 41 8 50 0-4 10-14 14-25 14S11 52 7 42z" fill="#c03a7a"/>`,
  ),
  // Lung, Hidden Disciple: a sealed training scroll.
  lung: svg(
    `<rect x="11" y="12" width="42" height="40" fill="#f0e0b0"/>` +
      `<rect x="6" y="7" width="52" height="9" rx="4.5" fill="#b0703a"/>` +
      `<rect x="6" y="48" width="52" height="9" rx="4.5" fill="#b0703a"/>` +
      `<path d="M18 24h28M18 31h22M18 38h14" stroke="#8a6a3a" stroke-width="2.2"/>` +
      `<circle cx="43" cy="39" r="5" fill="#c0283a"/>`,
  ),
  // Pacquiao, Glory Glove: a golden boxing glove.
  pacquiao: svg(
    `<rect x="20" y="48" width="28" height="10" rx="2" fill="#ffffff"/>` +
      `<path d="M14 30c0-14 10-21 22-21 12 0 19 8 19 19 0 8-4 13-8 15v6H22v-6c-5-3-8-8-8-13z" fill="#ffd23f"/>` +
      `<path d="M14 30c-2 7 2 13 10 13 4 0 7-3 7-7-5 0-9-2-11-6z" fill="#f0b000"/>` +
      `<path d="M30 15c6-2 12 0 15 4" fill="none" stroke="#fff3a0" stroke-width="2.5"/>`,
  ),
  // Zhu Yong, Dragon Ascendant: a flaming dragon pearl over rising chevrons.
  zhuyong: svg(
    line('M12 56l20-12 20 12', '#e0475e', 5) +
      line('M12 45l20-12 20 12', '#ff8a3d', 5) +
      `<polygon points="${burst(32, 17, 8, 15, 9)}" fill="#ff8a3d"/>` +
      `<circle cx="32" cy="17" r="9" fill="#ffd23f"/>` +
      `<path d="M28 14a4 4 0 0 1 4-3" fill="none" stroke="#ffffff" stroke-width="2"/>`,
  ),
  // Aurora, Permafrost: a block of ice.
  aurora: svg(
    `<path d="M32 7l23 11-23 11L9 18z" fill="#e0f8ff"/>` +
      `<path d="M9 18l23 11v27L9 45z" fill="#8fd8f8"/>` +
      `<path d="M55 18L32 29v27l23-11z" fill="#4aa6dd"/>` +
      `<path d="M14 26v12M37 34l12-6" stroke="#ffffff" stroke-width="2.4"/>`,
  ),
  // Harley, Stacked Deck: a fan of playing cards.
  harley: svg(
    `<rect x="20" y="10" width="24" height="36" rx="3" fill="#e8e8f0" transform="rotate(-24 32 54)"/>` +
      `<rect x="20" y="10" width="24" height="36" rx="3" fill="#f4f4fa" transform="rotate(24 32 54)"/>` +
      `<rect x="20" y="8" width="24" height="36" rx="3" fill="#ffffff"/>` +
      `<path d="M32 33c-6-4-8-8-5-11 2-2 4-1 5 1 1-2 3-3 5-1 3 3 1 7-5 11z" fill="#e0394c"/>` +
      `<path d="M24 13v4M40 39v-4" stroke="#e0394c" stroke-width="2"/>`,
  ),
  // Moscow, Shadow Procession: hooded shadows, each taller, under a crescent moon.
  moscow: svg(
    `<path d="M44 4a16 16 0 1 0 14 22A12 12 0 1 1 44 4z" fill="#b8aef0"/>` +
      `<path d="M12 40c-3 0-5 2-5 6v12h10V46c0-4-2-6-5-6z" fill="#3a3258"/>` +
      `<path d="M27 34c-4 0-6 3-6 8v16h12V42c0-5-2-8-6-8z" fill="#3a3258"/>` +
      `<path d="M44 28c-5 0-7 4-7 9v21h14V37c0-5-2-9-7-9z" fill="#3a3258"/>` +
      `<circle cx="27" cy="42" r="1.2" fill="#c38bff" stroke="none"/><circle cx="44" cy="37" r="1.4" fill="#c38bff" stroke="none"/>`,
  ),
  // Vex, Second Helping: a prize box with a plus.
  vex: svg(
    `<rect x="8" y="26" width="42" height="30" rx="3" fill="#8a55c9"/>` +
      `<rect x="5" y="20" width="48" height="9" rx="2" fill="#a678e0"/>` +
      `<rect x="26" y="20" width="6" height="36" fill="#ffd23f"/>` +
      `<circle cx="50" cy="16" r="11" fill="#3fae5a"/>` +
      `<path d="M50 10v12M44 16h12" stroke="#ffffff" stroke-width="3.2"/>`,
  ),
  // Fanny, Steel Cable: a grappling hook trailing its cable.
  fanny: svg(
    line('M5 59C18 52 22 42 30 36', '#c0c6d0', 3) +
      line('M30 36L46 20', '#8a93a6', 5) +
      line('M46 20c-8-4-15-1-17 5', '#8a93a6', 3.5) +
      line('M46 20c4-8 1-15-5-17', '#8a93a6', 3.5) +
      line('M46 20c8-2 13 3 13 9', '#8a93a6', 3.5) +
      `<circle cx="46" cy="20" r="4" fill="#dfe6f0"/>`,
  ),
};
