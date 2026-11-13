import { COMMANDERS } from '../game/commanders';
import { COMMANDER_SVGS } from './icons/commanders';
import { COMMANDER_CARD_SVGS } from './icons/commanderCards';
import { POWER_CARD_SVGS } from './icons/powerCards';
import { POWER_CARDS } from '../game/powerCards';
import { svgImg } from './icons';

// HTML: a commander's hand-drawn portrait (icons/commanders.ts), sized like the text around it; its emoji if it
// has none yet.
export const commanderIcon = (id: string | undefined) =>
  id && COMMANDER_SVGS[id] ? svgImg(COMMANDER_SVGS[id], 'cmd-svg') : ((id && COMMANDERS[id]?.icon) ?? '❔');

// HTML: a commander card's hand-drawn icon (icons/commanderCards.ts); its emoji if it has none yet.
export const commanderCardIcon = (id: string | undefined) =>
  id && COMMANDER_CARD_SVGS[id] ? svgImg(COMMANDER_CARD_SVGS[id], 'cmd-svg card-svg') : ((id && COMMANDERS[id]?.card.icon) ?? '❔');

// HTML: a power card's hand-drawn icon (icons/powerCards.ts); its emoji if it has none yet.
export const powerCardIcon = (id: string) => (POWER_CARD_SVGS[id] ? svgImg(POWER_CARD_SVGS[id], 'cmd-svg card-svg') : (POWER_CARDS[id]?.icon ?? '❔'));
