// Colors for the canvas, matching the CSS palette in style.css.

export const COLORS = {
  shield: 0xf2f6ff,
  panel: 0x1d2029,
  cell: 0x262a35,
  cellAlt: 0x2b303c,
  text: 0xe6e8ee,
  muted: 0x8b90a0,
  accent: 0xe0a63a,
  foe: 0xd65151,
  hp: 0x3fae5a,
  mana: 0x4a8ff0,
  heal: 0x3fae5a,
  crit: 0xff3b3b,
  spell: 0x8fb8ff,
  selected: 0xffffff,
};

export const TIER_COLORS: Record<number, number> = { 1: 0x8a8f99, 2: 0x3fae5a, 3: 0x3a84d6, 4: 0xa457d6, 5: 0xe0a63a, 7: 0xe0475e }; // by tier

// Per trait / item / skill effect id: flashes and damage numbers.
export const EFFECT_COLORS: Record<string, number> = {
  skybringer: 0xffe066,
  phasewarper: 0xc77dff,
  mooneater: 0x9db4ff,
  keris: 0xff6b9a,
  offering: 0xff8a3d,
  phantomexecution: 0xb48cff,
  phantom: 0x7a5cff,
  chaosassault: 0xe05cff,
  starfall: 0x8fd3ff,
  rendingbite: 0xff7a45,
  mournfulshot: 0xb9a7ff,
  fallingstar: 0x9ad8ff,
  soulorbit: 0x7dffd0,
  stormpursuit: 0xffe066,
  rampage: 0xff5a36,
  rampageburn: 0xff8a3d,
  gloomvolley: 0xa98bff,
  pyreaura: 0xff9f43,
  pyrefrenzy: 0xff5a36,
  dragonlance: 0xe0a63a,
  commandersmark: 0xffd166,
  markburst: 0xffd166,
};

// Special board tiles per trait.
export const TILE_COLORS: Record<string, number> = { dragonaltar: 0xe0a63a };

export function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
