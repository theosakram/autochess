import { blangkon } from './blangkon';
import { jimat } from './jimat';
import { keris } from './keris';
import { offering } from './offering';
import { aegis } from './aegis';
import { holyCrystal } from './holyCrystal';
import { iceQueenWand } from './iceQueenWand';
import { inspire } from './inspire';
import { purify } from './purify';
import { purpleBuff } from './purpleBuff';
import { seaHalberd } from './seaHalberd';
import { sheepStick } from './sheepStick';
import { retribution } from './retribution';
import { revitalize } from './revitalize';
import { berserkerFury } from './berserkerFury';
import { bladeOfDespair } from './bladeOfDespair';
import { demonHunterSword } from './demonHunterSword';
import { divineGlaive } from './divineGlaive';
import { glowingWand } from './glowingWand';
import { goldenStaff } from './goldenStaff';
import { haasClaw } from './haasClaw';
import { spellbladeTalisman } from './spellbladeTalisman';
import { thiefTool } from './thiefTool';
import { warAxe } from './warAxe';
import { winterCrown } from './winterCrown';
import type { ItemDef } from './types';

export type { HealingSpring, ItemAura, ItemDef, ItemKind, ItemPulse, LowHpFury, SideShield, StackingPassive } from './types';
export { AEGIS } from './aegis';
export { HOLY_CRYSTAL } from './holyCrystal';
export { ICE_QUEEN_WAND } from './iceQueenWand';
export { INSPIRE } from './inspire';
export { PURIFY } from './purify';
export { PURPLE_BUFF } from './purpleBuff';
export { SEA_HALBERD } from './seaHalberd';
export { SHEEP_STICK } from './sheepStick';
export { RETRIBUTION } from './retribution';
export { REVITALIZE } from './revitalize';
export { BLANGKON } from './blangkon';
export { JIMAT } from './jimat';
export { KERIS } from './keris';
export { OFFERING } from './offering';
export { BERSERKER_FURY } from './berserkerFury';
export { BLADE_OF_DESPAIR } from './bladeOfDespair';
export { DEMON_HUNTER_SWORD } from './demonHunterSword';
export { DIVINE_GLAIVE } from './divineGlaive';
export { GLOWING_WAND } from './glowingWand';
export { GOLDEN_STAFF } from './goldenStaff';
export { HAAS_CLAW } from './haasClaw';
export { SPELLBLADE_TALISMAN } from './spellbladeTalisman';
export { THIEF_TOOL } from './thiefTool';
export { WAR_AXE } from './warAxe';
export { WINTER_CROWN } from './winterCrown';

// Every item in the game. A new item is a new module plus one entry here.
export const ITEMS: Record<string, ItemDef> = Object.fromEntries([keris, blangkon, jimat, offering, warAxe, haasClaw, goldenStaff, bladeOfDespair, berserkerFury, demonHunterSword, seaHalberd, iceQueenWand, glowingWand, holyCrystal, divineGlaive, winterCrown, spellbladeTalisman, purpleBuff, sheepStick, thiefTool, aegis, inspire, purify, retribution, revitalize].map((i) => [i.id, i]));

// Equipment: the items no trait owns. Monster rounds drop them; they work on anyone.
export const EQUIPMENT: string[] = Object.values(ITEMS)
  .filter((i) => !i.trait && !i.basic)
  .map((i) => i.id);

// Basic items: also trait-free, but only from the round-2 pick (see BASIC_ITEM_ROUND).
export const BASIC_ITEMS: string[] = Object.values(ITEMS)
  .filter((i) => i.basic)
  .map((i) => i.id);

// Shop slots can hold an upgrade card for an item instead of a unit.
const CARD = 'item:';
export const isItemCard = (slot: string) => slot.startsWith(CARD);
export const itemCard = (itemId: string) => CARD + itemId;
export const cardItem = (slot: string) => slot.slice(CARD.length);
