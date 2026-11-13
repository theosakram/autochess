import { baseItemOf, ITEMS } from '../game/items';
import { GLOVE_SVGS, ITEM_SVGS } from './icons/items';
import { svgImg } from './icons';

// The SVG drawing for an item (its base item's, for an enhanced version), if it has one.
export const itemSvg = (id: string): string | undefined => ITEM_SVGS[baseItemOf(id)];

// HTML: an item's icon, sized like the text around it: its hand-drawn SVG (icons/items.ts), else its emoji.
export const itemIcon = (id: string) => {
  const s = itemSvg(id);
  return s ? svgImg(s, 'item-svg') : (ITEMS[id]?.icon ?? '❔');
};

// HTML: one of Pacquiao's gloves (gloves.ts), hand-drawn, else its emoji.
export const gloveIcon = (id: string, emoji: string) => (GLOVE_SVGS[id] ? svgImg(GLOVE_SVGS[id], 'item-svg') : emoji);
