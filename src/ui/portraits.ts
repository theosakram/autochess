import { UNIT_BY_ID } from '../game/units';
import { TIER_COLORS } from './stage/theme';
import { HERO_SVGS, svgImg } from './icons';

// How a hero looks. Every hero has its own picture, so it's known at a glance without reading its
// name. Real art can replace these later: this is the only place that decides what a hero shows.
export const PORTRAITS: Record<string, string> = {
  siyunyin: '🦎',
  phove: '🕯️',
  dyroth: '💂',
  cici: '🧨',
  val: '💀',
  eudora: '🍃',
  minos: '🌟',
  uranus: '🌁',

  luoyi: '🏮',
  natalie: '😱',
  ginger: '🦉',
  harley: '👤',
  belle: '🖋️',
  angela: '💃',
  zhuxin: '🌋',
  mia: '👺',
  balman: '🦅',
  martin: '☄️',
  hilos: '🗿',

  wan: '📯',
  saber: '🥀',
  kanina: '👸',
  mathilda: '📖',
  frank: '🎭',
  clint: '🌩️',
  katarina: '🧙',
  hilman: '🗡️',
  edith: '🏺',
  tig: '🗝️',
  aldo: '✊',
  pacquiao: '👊',

  suyu: '🏇',
  yang: '🦷',
  vex: '🧵',
  sora: '🦹',
  kari: '🤴',
  lunox: '🧘',
  lola: '🎇',
  gourd: '🧞',
  gufron: '🌪️',
  zhizong: '🦸',
  irina: '❄️',
  altus: '📕',

  fanny: '🧟',
  nana: '👁️',
  balia: '🐲',
  melina: '🏹',
  lance: '👹',
  balang: '🔱',
  odette: '👼',
  thamar: '☠️',
  alice: '🧛',
  bossalpha: '👽',

  gatotkaca: '🤜',
  moscow: '🕶️',
  amon: '🐆',
  cyborg: '🏯',
  novaria: '🃏',
  kenarok: '🐍',
  roro: '🧜',
  gadjahmada: '🐘',

  mythbeast: '🦄',
  spiritarcher: '🦋',
  mistwolf: '🐺',
  stonegolem: '🗻',
  elderdrake: '🦖',
  divinebeast: '🐯',
};

// Johnson's Johnnies (one def per faction + role pair) all share one face.
export const JOHNNIE_PORTRAIT = '🤠';
export const portraitOf = (defId: string) => PORTRAITS[defId] ?? (UNIT_BY_ID[defId]?.johnnie ? JOHNNIE_PORTRAIT : UNIT_BY_ID[defId]?.turret ? '🗼' : '❔');

// An inline plate for the HTML side, in the hero's cost colour, the same as on the board. The colour
// comes in as --plate; style.css draws the rest.
export function portraitHtml(defId: string, className = ''): string {
  const icon = HERO_SVGS[defId];
  const color = icon?.plate ?? `#${TIER_COLORS[UNIT_BY_ID[defId].tier].toString(16).padStart(6, '0')}`;
  return `<span class="portrait ${className}${icon ? ' has-svg' : ''}" style="--plate:${color}">${icon ? svgImg(icon.svg, icon.className) : portraitOf(defId)}</span>`;
}
