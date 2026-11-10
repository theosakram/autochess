import { ALICE } from './alice';
import { ANGELA } from './angela';
import { ALPHA } from './alpha';
import { AMON } from './amon';
import { BALANG } from './balang';
import { BALIA } from './balia';
import { CICI } from './cici';
import { CLINT } from './clint';
import { CYBORG } from './cyborg';
import { EUDORA } from './eudora';
import { FANNY } from './fanny';
import type { GlyphIcon } from './glyph';
import { GATOTKACA } from './gatotkaca';
import { GUFRON } from './gufron';
import { HARLEY } from './harley';
import { HILMAN } from './hilman';
import { HILOS } from './hilos';
import { KENAROK } from './kenarok';
import { LANCE } from './lance';
import { LUNOX } from './lunox';
import { MELINA } from './melina';
import { MIA } from './mia';
import { MINOS } from './minos';
import { MOSCOW } from './moscow';
import { NANA } from './nana';
import { NOVARIA } from './novaria';
import { ODETTE } from './odette';
import { SABER } from './saber';
import { SIYUNYIN } from './siyunyin';
import { THAMAR } from './thamar';
import { ZHIZONG } from './zhizong';

// Hand-made SVG icons, replacing a hero's emoji portrait or a skill's emoji icon. Anything not here keeps its
// emoji (portraits.ts, skillIcons.ts), so heroes can move over one at a time. A hero's `plate` replaces its
// cost-coloured background (the icon's own theme).
export const HERO_SVGS: Record<string, GlyphIcon> = { saber: SABER, gufron: GUFRON, lance: LANCE, melina: MELINA, odette: ODETTE, bossalpha: ALPHA, thamar: THAMAR, fanny: FANNY, balia: BALIA, kenarok: KENAROK, moscow: MOSCOW, balang: BALANG, nana: NANA, alice: ALICE, amon: AMON, cyborg: CYBORG, novaria: NOVARIA, gatotkaca: GATOTKACA, minos: MINOS, siyunyin: SIYUNYIN, angela: ANGELA, clint: CLINT, cici: CICI, hilman: HILMAN, mia: MIA, lunox: LUNOX, eudora: EUDORA, harley: HARLEY, hilos: HILOS, zhizong: ZHIZONG };
export const SKILL_SVGS: Record<string, GlyphIcon> = {
  soulorbit: SABER,
  stormpursuit: GUFRON,
  phantomexecution: LANCE,
  spiritarchers: MELINA,
  starfallaegis: ODETTE,
  spectralcataclysm: ALPHA,
  undyingfury: THAMAR,
  rampage: FANNY,
  dragonsdominion: BALIA,
  kerisslash: KENAROK,
  wanderersvolley: MOSCOW,
  stormfists: BALANG,
  mistboomerang: NANA,
  dreaddescent: ALICE,
  stalkersmark: AMON,
  craterfall: CYBORG,
  fatethread: NOVARIA,
  bladedescent: GATOTKACA,
  starward: MINOS,
  rendingbite: SIYUNYIN,
  taripenyembuh: ANGELA,
  stormflurry: CLINT,
  kindletwice: CICI,
  zodiacslam: HILMAN,
  galeshot: EUDORA,
  shadebolts: HARLEY,
  guardiansstrike: HILOS,
  skyreap: ZHIZONG,
  powerofchaos: LUNOX,
  pyrefrenzy: MIA,
};

// An <img> of the SVG for the HTML side (an image, so each copy's ids and styles stay its own).
export const svgImg = (svg: string, className = '') =>
  `<img class="svg-icon ${className}" src="data:image/svg+xml,${encodeURIComponent(svg)}" alt="" draggable="false">`;
