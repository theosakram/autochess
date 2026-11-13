// Hand-drawn commander portraits (64x64), replacing their emoji: an emoji the OS font lacks shows as nothing
// (Windows 10 stops around Emoji 12). Flat shapes with a dark outline, so they still read at 26px.
// The commander's emoji (CommanderDef.icon) stays as the fallback for anyone not here.

export const OUTLINE = '#1d1622';
export const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">` +
  `<g stroke="${OUTLINE}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

// A line drawn twice, outline under colour, so stroke-only shapes get the same dark rim as the filled ones.
export const line = (d: string, color: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${OUTLINE}" stroke-width="${width + 3}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"/>`;

// A star/burst polygon: n points alternating between radius r1 (tips) and r2 (dips).
export function burst(cx: number, cy: number, n: number, r1: number, r2: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

export const MIRROR_X = 'transform="matrix(-1 0 0 1 64 0)"';

export const COMMANDER_SVGS: Record<string, string> = {
  // Alice, the Crimson Countess: a bat across a blood moon, a drop beneath.
  alice: svg(
    `<circle cx="32" cy="27" r="21" fill="#e0394c"/>` +
      `<g transform="translate(32 27) scale(1.3) translate(-32 -27)"><path d="M32 25c-4-6-11-8-19-6 3 3 3 7 1 10 4-1 8 0 10 4 2-2 5-3 8-2 3-1 6 0 8 2 2-4 6-5 10-4-2-3-2-7 1-10-8-2-15 0-19 6z" fill="#2a0f1a"/>` +
      `<path d="M29 26l1-5 2 3 2-3 1 5z" fill="#2a0f1a"/>` +
      `<circle cx="30.5" cy="27" r="1" fill="#ffd23f" stroke="none"/><circle cx="33.5" cy="27" r="1" fill="#ffd23f" stroke="none"/></g>` +
      `<path d="M32 49c-3 3-4 5-4 7a4 4 0 0 0 8 0c0-2-1-4-4-7z" fill="#c0283a"/>`,
  ),
  // Amon, Keeper of the Mirror: a hand mirror, its glass catching the light.
  amon: svg(
    `<rect x="29" y="40" width="6" height="20" rx="3" fill="#5b3590"/>` +
      `<ellipse cx="32" cy="24" rx="17" ry="20" fill="#8a55c9"/>` +
      `<ellipse cx="32" cy="24" rx="12" ry="15" fill="#bfe6ff"/>` +
      `<path d="M24 20l7-7M24 27l12-12" stroke="#ffffff" stroke-width="3"/>` +
      `<path d="M32 40l4 3-4 3-4-3z" fill="#5fe0ff"/>`,
  ),
  // Angela, Guardian Angel: a halo over two wings and a heart.
  angela: svg(
    line('M19 11a13 4.5 0 1 0 26 0a13 4.5 0 1 0-26 0', '#ffd23f', 3.5) +
      `<path d="M30 30C20 18 6 20 3 30c5 2 5 6 3 8 6 2 8 6 6 8 8 2 16-4 18-10z" fill="#ffffff"/>` +
      `<path d="M30 30C20 18 6 20 3 30c5 2 5 6 3 8 6 2 8 6 6 8 8 2 16-4 18-10z" fill="#ffffff" ${MIRROR_X}/>` +
      `<path d="M32 54C22 46 21 34 27 32c3-1 5 2 5 4 0-2 2-5 5-4 6 2 5 14-5 22z" fill="#ff6fa0"/>`,
  ),
  // Aurora, Queen of the Northern Lights: a crown of ice spikes.
  aurora: svg(
    `<path d="M9 46L12 18l10 14L32 8l10 24 10-14 3 28z" fill="#a9ecff"/>` +
      `<path d="M22 32L32 8l10 24-10 6z" fill="#d9f7ff"/>` +
      `<rect x="8" y="44" width="48" height="10" rx="3" fill="#4aa6dd"/>` +
      `<circle cx="20" cy="49" r="2.5" fill="#e6fbff"/><circle cx="44" cy="49" r="2.5" fill="#e6fbff"/>` +
      `<path d="M32 44l4 5-4 5-4-5z" fill="#c38bff"/>` +
      `<path d="M32 18v14M26 25h12M28 21l8 8M36 21l-8 8" stroke="#4aa6dd" stroke-width="1.6"/>`,
  ),
  // Cyclops, the Watchful Scavenger: one great eye.
  cyclops: svg(
    `<path d="M28 9l4-7 4 7z" fill="#f0e0c0"/>` +
      `<circle cx="32" cy="34" r="25" fill="#7a5cd6"/>` +
      `<path d="M12 33c6-10 34-10 40 0-6 10-34 10-40 0z" fill="#ffffff"/>` +
      `<circle cx="32" cy="33" r="8" fill="#ffb020"/><circle cx="32" cy="33" r="4" fill="#1d1622"/>` +
      `<circle cx="34.5" cy="30.5" r="1.8" fill="#ffffff" stroke="none"/>` +
      `<path d="M14 22q18-9 36 0" fill="none" stroke-width="3"/>` +
      `<path d="M24 50q8 4 16 0" fill="none"/>`,
  ),
  // Dyroth, Lord of the Greater Demon Altar: a horned demon's head.
  dyroth: svg(
    `<path d="M20 24C12 20 7 10 11 3c3 9 9 13 15 15z" fill="#3a2a30"/>` +
      `<path d="M20 24C12 20 7 10 11 3c3 9 9 13 15 15z" fill="#3a2a30" ${MIRROR_X}/>` +
      `<path d="M14 32c0-14 36-14 36 0 0 14-10 26-18 28-8-2-18-14-18-28z" fill="#d23b3b"/>` +
      `<path d="M19 31l10 4-8 2z" fill="#ffd23f"/><path d="M45 31l-10 4 8 2z" fill="#ffd23f"/>` +
      `<path d="M22 44q10 8 20 0-10 4-20 0z" fill="#2a0a10"/>` +
      `<path d="M25 45.5l1.5 3 1.5-2.5M39 45.5l-1.5 3-1.5-2.5" fill="#ffffff" stroke-width="1"/>`,
  ),
  // Fanny, Blade Dancer: a kunai on its steel cable.
  fanny: svg(
    line('M42 42C54 50 60 38 54 32 49 27 42 34 48 40 54 46 50 58 38 58 28 58 22 52 10 58', '#c8d2e0', 4) +
      `<g transform="translate(28 28) rotate(-45) scale(1.2)">` +
      `<path d="M0-28L8-6 3-2h-6l-5-4z" fill="#e4ecf6"/><path d="M0-28L8-6 3-2H0z" fill="#b9c6d8"/>` +
      `<rect x="-2.5" y="-2" width="5" height="15" fill="#2b4fa8"/>` +
      `<circle cy="17" r="4.5" fill="none" stroke-width="3"/></g>` +
      `<circle cx="42" cy="42" r="1" fill="#a8286e"/>`,
  ),
  // Freya, Lady of the Blessed Fields: a blossom.
  freya: svg(
    [0, 72, 144, 216, 288].map((a) => `<path d="M32 31C24 24 24 10 29 7l3 3 3-3c5 3 5 17-3 24z" fill="#ffb3d1" transform="rotate(${a} 32 32)"/>`).join('') +
      `<circle cx="32" cy="32" r="7" fill="#ffd23f"/>` +
      `<circle cx="29.5" cy="30.5" r="1.2" fill="#e08a00" stroke="none"/><circle cx="34" cy="31" r="1.2" fill="#e08a00" stroke="none"/><circle cx="32" cy="34.5" r="1.2" fill="#e08a00" stroke="none"/>`,
  ),
  // Guiness, the Lucky Brewer: a foaming mug with a clover on it.
  guiness: svg(
    line('M42 30h5a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6h-5', '#e6e2d8', 4) +
      `<rect x="13" y="22" width="30" height="36" rx="4" fill="#f2a516"/>` +
      `<path d="M19 30v22M37 30v22" stroke="#ffcf5a" stroke-width="3"/>` +
      `<path d="M11 26c-3-8 6-13 11-10 2-6 13-6 15 0 5-4 13 1 10 9 1 4-3 6-6 4H14c-2 0-3-1-3-3z" fill="#ffffff"/>` +
      `<g fill="#2fae5a" stroke-width="1.5"><circle cx="28" cy="38" r="3.5"/><circle cx="24.5" cy="43" r="3.5"/><circle cx="31.5" cy="43" r="3.5"/></g>` +
      `<path d="M28 44l1 6" stroke="#1e7a3e" stroke-width="2"/>`,
  ),
  // Harley, the Wildcard: a jester's hat with bells.
  harley: svg(
    `<path d="M14 40C10 30 9 20 4 15c13 1 21 11 23 21z" fill="#7b3fd0"/>` +
      `<path d="M14 40C10 30 9 20 4 15c13 1 21 11 23 21z" fill="#2fbf71" ${MIRROR_X}/>` +
      `<path d="M23 38c0-12 4-24 9-31 5 7 9 19 9 31z" fill="#ffcc33"/>` +
      `<rect x="11" y="37" width="42" height="11" rx="5" fill="#e8455a"/>` +
      `<path d="M20 42.5l3-3 3 3-3 3zM29 42.5l3-3 3 3-3 3zM38 42.5l3-3 3 3-3 3z" fill="#ffcc33" stroke-width="1.2"/>` +
      `<g fill="#ffd84a"><circle cx="5" cy="15" r="4"/><circle cx="32" cy="7" r="4"/><circle cx="59" cy="15" r="4"/></g>` +
      `<path d="M22 54q10 7 20 0" fill="none" stroke-width="2.5"/>`,
  ),
  // Johnson, Head of the Johnnie Family: a top hat and a moustache.
  johnson: svg(
    `<ellipse cx="32" cy="40" rx="27" ry="6" fill="#4a4a5c"/>` +
      `<path d="M17 40V12c0-2 2-4 4-4h22c2 0 4 2 4 4v28z" fill="#55556c"/>` +
      `<rect x="17" y="30" width="30" height="7" fill="#c9a227"/>` +
      `<path d="M23 12v16M12 39q20 4 40 0" fill="none" stroke="#8888a4" stroke-width="2.5"/>` +
      `<path d="M32 53c-4-5-12-5-18 1 6 0 10 5 18 2 8 3 12-2 18-2-6-6-14-6-18-1z" fill="#6b4426"/>`,
  ),
  // Kaela, Keeper of the Treasure Grove: a lucky die.
  kaela: svg(
    `<path d="M32 6l24 12-24 12L8 18z" fill="#ffffff"/>` +
      `<path d="M8 18l24 12v28L8 46z" fill="#e3e3ec"/>` +
      `<path d="M56 18L32 30v28l24-12z" fill="#c6c6d6"/>` +
      `<ellipse cx="32" cy="18" rx="4.5" ry="2.5" fill="#2fae5a" stroke="none"/>` +
      `<g fill="#1d1622" stroke="none"><ellipse cx="14" cy="27" rx="2" ry="2.5"/><ellipse cx="26" cy="45" rx="2" ry="2.5"/>` +
      `<ellipse cx="50" cy="27" rx="2" ry="2.5"/><ellipse cx="44" cy="37" rx="2" ry="2.5"/><ellipse cx="38" cy="47" rx="2" ry="2.5"/></g>`,
  ),
  // Kagura, Mistress of the Umbrella: an open paper umbrella.
  kagura: svg(
    line('M32 34v19a4 4 0 0 1-8 0', '#8a5a2b', 3) +
      `<path d="M4 34Q8 6 32 5q24 1 28 29-7-5-14 0-7-5-14 0-7-5-14 0-7-5-14 0z" fill="#e04a6a"/>` +
      `<path d="M32 5v29M32 5Q20 14 18 34M32 5q12 9 14 29M32 5Q12 12 4 34M32 5q20 7 28 29" fill="none" stroke="#a82848" stroke-width="1.5"/>` +
      `<path d="M10 20c3-2 6-2 8 0M40 14c3-1 5 0 7 2" fill="none" stroke="#ffd6e0" stroke-width="2"/>` +
      `<circle cx="32" cy="5" r="2.5" fill="#8a5a2b"/>`,
  ),
  // Katarina, Sinister Blade: two daggers crossed.
  katarina: svg(
    [-40, 40]
      .map(
        (a) =>
          `<g transform="translate(32 35) rotate(${a}) scale(1.15)">` +
          `<path d="M0-30c5 10 6 18 5 24H-5c-1-6 0-14 5-24z" fill="#e4ecf6"/><path d="M0-30c5 10 6 18 5 24H0z" fill="#b9c6d8"/>` +
          `<rect x="-10" y="-7" width="20" height="4" rx="1" fill="#b8243a"/>` +
          `<rect x="-2.5" y="-3" width="5" height="13" fill="#3a1a22"/><circle cy="12" r="3.5" fill="#b8243a"/></g>`,
      )
      .join(''),
  ),
  // Kenzo, Master of the Black Sash: a knotted black belt on white cloth.
  kenzo: svg(
    `<circle cx="32" cy="32" r="28" fill="#ece5d6"/>` +
      `<path d="M6 25h52v11H6z" fill="#24242c" stroke="none"/><path d="M6 25h52M6 36h52" fill="none"/>` +
      `<path d="M27 33l-10 23 7 2 8-20zM37 33l10 23-7 2-8-20z" fill="#24242c"/>` +
      `<path d="M18.5 52.5l6.5 2M45.5 52.5l-6.5 2" stroke="#d4a514" stroke-width="2.5"/>` +
      `<rect x="25" y="23" width="14" height="15" rx="3" fill="#2e2e38"/>`,
  ),
  // Lukas, Keeper of the Divine Beast: a lion's head in its mane.
  lukas: svg(
    `<polygon points="${burst(32, 33, 12, 29, 22)}" fill="#d9822b"/>` +
      `<circle cx="18" cy="17" r="5" fill="#f4c46a"/><circle cx="46" cy="17" r="5" fill="#f4c46a"/>` +
      `<circle cx="32" cy="34" r="17" fill="#f4c46a"/>` +
      `<ellipse cx="32" cy="42" rx="9" ry="7" fill="#fff1d0"/>` +
      `<path d="M28 37h8l-4 4z" fill="#6b3a1f"/><path d="M32 41v3m0 0q-3 3-6 1m6-1q3 3 6 1" fill="none" stroke-width="1.6"/>` +
      `<circle cx="25" cy="30" r="2" fill="#1d1622" stroke="none"/><circle cx="39" cy="30" r="2" fill="#1d1622" stroke="none"/>` +
      `<path d="M28 18l4 4 4-4" fill="none" stroke="#ffd23f" stroke-width="2"/>`,
  ),
  // Lung, Master of the Dueling Ring: two swords crossed over a ring.
  lung: svg(
    `<circle cx="32" cy="34" r="22" fill="#f3d9a4"/>` +
      line('M10 34a22 22 0 1 0 44 0a22 22 0 1 0-44 0', '#c0392b', 4) +
      [-45, 45]
        .map(
          (a) =>
            `<g transform="translate(32 32) rotate(${a})">` +
            `<path d="M0-29l3 4v26h-6v-26z" fill="#dfe7f2"/>` +
            `<rect x="-8" y="1" width="16" height="4" rx="2" fill="#c9a227"/>` +
            `<rect x="-2" y="5" width="4" height="12" fill="#3a2a30"/><circle cy="19" r="2.5" fill="#c9a227"/></g>`,
        )
        .join(''),
  ),
  // Lunox, Herald of Twilight: light and dark wound into one disc.
  lunox: svg(
    `<circle cx="32" cy="32" r="26" fill="#ffd65a"/>` +
      `<path d="M32 6a26 26 0 0 1 0 52 13 13 0 0 1 0-26 13 13 0 0 0 0-26z" fill="#5b2ca0"/>` +
      `<circle cx="32" cy="19" r="4" fill="#5b2ca0"/><circle cx="32" cy="45" r="4" fill="#ffd65a"/>` +
      `<path d="M47 23l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#ffffff" stroke="none"/>` +
      `<circle cx="43" cy="36" r="1.2" fill="#ffffff" stroke="none"/>` +
      `<circle cx="32" cy="32" r="26" fill="none"/>`,
  ),
  // Luo Yi, Sage of the Deep Earth: crystals breaking out of rock.
  luoyi: svg(
    `<path d="M22 42l-8-22 6-6 6 5 2 23z" fill="#3fd0c0"/><path d="M20 14l6 5 2 23-6 0z" fill="#9ff5ea"/>` +
      `<path d="M26 44l2-34 5-6 5 6 0 34z" fill="#3fd0c0"/><path d="M33 4l5 6v34h-5z" fill="#9ff5ea"/>` +
      `<path d="M38 44l4-24 6-3 5 5-6 22z" fill="#3fd0c0"/><path d="M48 17l5 5-6 22-5 0z" fill="#9ff5ea"/>` +
      `<path d="M4 58l6-16 12-4 10 3 12-4 12 6 4 15z" fill="#7a5a3a"/>` +
      `<path d="M14 50l8-2M38 48l8 2" stroke="#5a3f26" stroke-width="2"/>`,
  ),
  // Minos, Forgemaster of the Labyrinth: a bull's head with a ring through its nose.
  minos: svg(
    `<path d="M16 22C8 22 3 14 4 6c3 7 9 9 16 8z" fill="#f2e6c8"/>` +
      `<path d="M16 22C8 22 3 14 4 6c3 7 9 9 16 8z" fill="#f2e6c8" ${MIRROR_X}/>` +
      `<path d="M8 22l8 4M56 22l-8 4" stroke-width="5" stroke="#8a4b2a"/>` +
      `<path d="M15 20c0-8 34-8 34 0l-2 18c0 4-2 6-4 6H21c-2 0-4-2-4-6z" fill="#8a4b2a"/>` +
      `<ellipse cx="32" cy="46" rx="13" ry="10" fill="#c98a62"/>` +
      `<ellipse cx="27" cy="45" rx="2" ry="3" fill="#3a1d10"/><ellipse cx="37" cy="45" rx="2" ry="3" fill="#3a1d10"/>` +
      line('M28 52a4 4 0 1 0 8 0', '#ffcc33', 2.5) +
      `<circle cx="24" cy="30" r="2.5" fill="#1d1622" stroke="none"/><circle cx="40" cy="30" r="2.5" fill="#1d1622" stroke="none"/>`,
  ),
  // Miya, Moonlit Elf Archer: an arrow across a crescent moon.
  miya: svg(
    `<path d="M40 5a27 27 0 1 0 19 39A21 21 0 1 1 40 5z" fill="#cfe0ff"/>` +
      `<circle cx="16" cy="38" r="2" fill="#a9c2f0" stroke="none"/><circle cx="22" cy="48" r="1.5" fill="#a9c2f0" stroke="none"/>` +
      line('M12 52L50 14', '#8a5a2b', 2.5) +
      `<path d="M50 14l-9 2 7 7z" fill="#e4ecf6"/>` +
      `<path d="M12 52l-6-1 4-4zM12 52l1 6 4-4z" fill="#3fbf6f" stroke-width="1.5"/>` +
      `<path d="M8 47l8 1M13 55l-1-8" fill="none" stroke="#3fbf6f" stroke-width="3"/>`,
  ),
  // Moscow, Keeper of the Shadow Altar: a candle with a violet flame.
  moscow: svg(
    `<path d="M32 4c6 8 9 13 9 18a9 9 0 0 1-18 0c0-5 3-10 9-18z" fill="#8a3cff"/>` +
      `<path d="M32 13c3 4 4 7 4 9a4 4 0 0 1-8 0c0-2 1-5 4-9z" fill="#e2c8ff" stroke="none"/>` +
      `<path d="M32 26v4" stroke-width="2"/>` +
      `<path d="M23 30h18v24H23z" fill="#ece6f4"/>` +
      `<path d="M23 30h18v4c-2 0-2 6-4 6s-2-4-4-4-2 8-4 8-2-6-3-6-2 2-3 2z" fill="#ffffff" stroke-width="1.5"/>` +
      `<path d="M12 54h40l-4 6H16z" fill="#3a2a4a"/>`,
  ),
  // Nana, Tanuki Trickster: a tanuki with a leaf on its head.
  nana: svg(
    `<path d="M14 24L12 8l14 8zM50 24l2-16-14 8z" fill="#8a5a3a"/>` +
      `<path d="M14 18l-1-7 7 4zM50 18l1-7-7 4z" fill="#3a2418" stroke="none"/>` +
      `<ellipse cx="32" cy="36" rx="23" ry="21" fill="#a8744c"/>` +
      `<path d="M10 36c6-8 14-6 18 0-4 6-12 8-18 0zM54 36c-6-8-14-6-18 0 4 6 12 8 18 0z" fill="#3a2418"/>` +
      `<circle cx="21" cy="35" r="2.5" fill="#ffffff" stroke="none"/><circle cx="43" cy="35" r="2.5" fill="#ffffff" stroke="none"/>` +
      `<ellipse cx="32" cy="47" rx="10" ry="8" fill="#f3e2c8"/>` +
      `<ellipse cx="32" cy="43" rx="3" ry="2" fill="#1d1622"/>` +
      `<path d="M28 49q4 3 8 0" fill="none" stroke-width="1.6"/>` +
      `<path d="M32 16c-2-8 6-14 14-12-1 8-7 13-14 12zM32 16l9-8" fill="#5cc45a" stroke-width="1.6"/>`,
  ),
  // Pacquiao, the People's Champ: a red boxing glove.
  pacquiao: svg(
    `<path d="M18 30c0-16 12-22 22-20 12 2 16 14 14 24-1 8-6 12-10 14H22c-3-4-4-10-4-18z" fill="#e02d2d"/>` +
      `<path d="M19 32c-8-2-11 8-5 12 3 2 7 0 8-2z" fill="#c22020"/>` +
      `<path d="M27 16c6-3 14-2 18 2" fill="none" stroke="#ff8a8a" stroke-width="3"/>` +
      `<rect x="20" y="47" width="27" height="13" rx="2" fill="#f4f4f4"/>` +
      `<path d="M28 50l11 7M39 50l-11 7" stroke="#c22020" stroke-width="1.6"/>` +
      `<path d="M38 24l2 4 4.5.5-3.3 3 1 4.5-4.2-2.3-4 2.3.8-4.5-3.3-3 4.5-.5z" fill="#ffd23f" stroke-width="1.2"/>`,
  ),
  // Ruby, Little Red Reaper: a scythe with a rose at its head.
  ruby: svg(
    line('M14 60L44 8', '#7a4a2a', 4) +
      `<path d="M44 7C30 2 14 8 5 22c12-8 26-10 38-6z" fill="#dfe7f2"/>` +
      `<path d="M44 7C30 2 14 8 5 22c10-10 24-12 38-11z" fill="#ffffff" stroke="none"/>` +
      `<path d="M30 46c-6-2-10 2-10 6l8-2zM34 50c4 4 2 9-2 10l0-8z" fill="#3fa05a" stroke-width="1.5"/>` +
      `<circle cx="31" cy="43" r="8" fill="#d42a46"/>` +
      `<path d="M31 43a3 3 0 1 1 3 3c-4 0-6-3-6-6 0-4 6-6 9-2" fill="none" stroke="#8a1028" stroke-width="1.6"/>`,
  ),
  // Vex, Keeper of the Box: a ribboned gift box.
  vex: svg(
    `<rect x="11" y="30" width="42" height="28" rx="2" fill="#7b3fd0"/>` +
      `<rect x="7" y="22" width="50" height="10" rx="2" fill="#9a5cf0"/>` +
      `<path d="M28 22h8v36h-8z" fill="#ffcc33"/>` +
      `<path d="M32 22c-6-10-18-12-16-4 1 4 8 5 16 4zM32 22c6-10 18-12 16-4-1 4-8 5-16 4z" fill="#ffcc33"/>` +
      `<circle cx="32" cy="21" r="3.5" fill="#f0a800"/>` +
      `<path d="M15 38v14M49 38v14" stroke="#9a5cf0" stroke-width="2.5"/>`,
  ),
  // Zhu Yong, Warden of the Black Dragon Hoard: a black dragon over its gold.
  zhuyong: svg(
    `<g fill="#f2c531"><ellipse cx="18" cy="56" rx="12" ry="4"/><ellipse cx="18" cy="51" rx="12" ry="4"/>` +
      `<ellipse cx="44" cy="57" rx="12" ry="4"/><ellipse cx="32" cy="49" rx="11" ry="4"/></g>` +
      `<path d="M20 16C16 8 20 2 28 2c-4 4-4 10-2 12z" fill="#c9a227"/>` +
      `<path d="M12 20l2-8 4 6 3-8 3 7 4-7 2 8z" fill="#c9a227"/>` +
      `<path stroke="#c9a227" d="M6 32C8 20 20 13 34 14l14-5-3 7c8 2 13 8 13 14l-8 2 6 6c-8 2-16 0-22-2-6 6-16 6-22 2-4-1-6-3-6-6z" fill="#3a3c50"/>` +
      `<path d="M14 26q4-4 10-3M34 34q-6 2-10 0" fill="none" stroke="#6a6c84" stroke-width="2"/>` +
      `<path d="M35 19l8 3-8 3z" fill="#ff3b3b"/>` +
      line('M50 33c6 8 0 12 6 18', '#c9a227', 2),
  ),
};
