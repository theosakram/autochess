import { UNIT_BY_ID } from '../game/units';
import { TIER_COLORS } from './stage/theme';

// How a hero looks. Every hero has its own picture, so it's known at a glance without reading its
// name. Real art can replace these later: this is the only place that decides what a hero shows.
export const PORTRAITS: Record<string, string> = {
  drakeling: '🦎',
  wisp: '🕯️',
  prajurit: '💂',
  kindler: '🧨',
  boneadept: '💀',
  galekin: '🍃',
  stardustsquire: '🌟',
  hazeguard: '🌁',

  altarkeeper: '🏮',
  banshee: '😱',
  gloomshot: '🦉',
  shadewalker: '👤',
  inkling: '🖋️',
  penari: '💃',
  ashbinder: '🌋',
  pyreguard: '👺',
  thunderhawk: '🦅',
  cometlancer: '☄️',
  dwarapala: '🗿',

  wyrmcaller: '📯',
  soulreaper: '🥀',
  rarajonggrang: '👸',
  chronicler: '📖',
  dalang: '🎭',
  stormherald: '🌩️',
  nebulaseer: '🧙',
  zodiacblade: '🗡️',
  ashwarden: '🏺',
  cryptwarden: '🗝️',
  fogfist: '✊',
  phantomblade: '👊',

  drakerider: '🏇',
  wyrmfang: '🦷',
  mythweaver: '🧵',
  graverobber: '🦹',
  senopati: '🤴',
  resi: '🧘',
  pyromancer: '🎇',
  ethersage: '🧞',
  tempestknight: '🌪️',
  skyreaver: '🦸',
  polaris: '❄️',
  taleshield: '📕',

  abomination: '🧟',
  mistoracle: '👁️',
  ancientdragon: '🐲',
  arjuna: '🏹',
  batarakala: '👹',
  thunderlord: '🔱',
  empyrean: '👼',
  revenant: '☠️',
  wraithlord: '🧛',
  eidolon: '👽',

  wanderingblade: '🤜',
  wanderingeye: '🕶️',
  wanderinghunter: '🐆',
  wanderingbastion: '🏯',
  wanderingseer: '🃏',

  mythbeast: '🦄',
  spiritarcher: '🦋',
  mistwolf: '🐺',
  stonegolem: '🗻',
  elderdrake: '🦖',
  divinebeast: '🐯',
};

// An inline plate for the HTML side, in the hero's cost colour, the same as on the board. The colour
// comes in as --plate; style.css draws the rest.
export function portraitHtml(defId: string, className = ''): string {
  const color = `#${TIER_COLORS[UNIT_BY_ID[defId].tier].toString(16).padStart(6, '0')}`;
  return `<span class="portrait ${className}" style="--plate:${color}">${PORTRAITS[defId]}</span>`;
}
