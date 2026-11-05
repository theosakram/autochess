import { blangkon } from './blangkon';
import { jimat } from './jimat';
import { keris } from './keris';
import { offering } from './offering';
import type { ItemDef } from './types';

export type { ItemAura, ItemDef, ItemKind, ItemPulse } from './types';
export { BLANGKON } from './blangkon';
export { JIMAT } from './jimat';
export { KERIS } from './keris';
export { OFFERING } from './offering';

// Every item in the game. A new item is a new module plus one entry here.
export const ITEMS: Record<string, ItemDef> = Object.fromEntries([keris, blangkon, jimat, offering].map((i) => [i.id, i]));

// Shop slots can hold an upgrade card for an item instead of a unit.
const CARD = 'item:';
export const isItemCard = (slot: string) => slot.startsWith(CARD);
export const itemCard = (itemId: string) => CARD + itemId;
export const cardItem = (slot: string) => slot.slice(CARD.length);
