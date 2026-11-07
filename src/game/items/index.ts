import { blangkon } from './blangkon';
import { jimat } from './jimat';
import { keris } from './keris';
import { offering } from './offering';
import { oracle } from './oracle';
import { aegis } from './aegis';
import { ancientWrath } from './ancientWrath';
import { antiqueCuirass } from './antiqueCuirass';
import { holyCrystal } from './holyCrystal';
import { iceQueenWand } from './iceQueenWand';
import { inspire } from './inspire';
import { purify } from './purify';
import { iceLongbow } from './iceLongbow';
import { essenceCore } from './essenceCore';
import { redCloak } from './redCloak';
import { purpleBuff } from './purpleBuff';
import { seaHalberd } from './seaHalberd';
import { scythe } from './scythe';
import { sheepStick } from './sheepStick';
import { retribution } from './retribution';
import { revitalize } from './revitalize';
import { berserkerFury } from './berserkerFury';
import { blackSash } from './blackSash';
import { bladeArmor } from './bladeArmor';
import { bladeOfDespair } from './bladeOfDespair';
import { demonHunterSword } from './demonHunterSword';
import { divineGlaive } from './divineGlaive';
import { dominanceIce } from './dominanceIce';
import { glowingWand } from './glowingWand';
import { guardianHelmet } from './guardianHelmet';
import { goldenStaff } from './goldenStaff';
import { haasClaw } from './haasClaw';
import { spellbladeTalisman } from './spellbladeTalisman';
import { thiefTool } from './thiefTool';
import { thunderBelt } from './thunderBelt';
import { warAxe } from './warAxe';
import { winterCrown } from './winterCrown';
import type { ItemDef } from './types';

export { EQUIPMENT_GROUPS } from './types';
export type { EquipmentGroup, HealingSpring, ItemAura, ItemDef, ItemKind, ItemPulse, LowHpFury, SideShield, StackingPassive } from './types';
export { AEGIS } from './aegis';
export { ANCIENT_WRATH } from './ancientWrath';
export { ANTIQUE_CUIRASS } from './antiqueCuirass';
export { HOLY_CRYSTAL } from './holyCrystal';
export { ICE_QUEEN_WAND } from './iceQueenWand';
export { INSPIRE } from './inspire';
export { PURIFY } from './purify';
export { ICE_LONGBOW } from './iceLongbow';
export { ESSENCE_CORE } from './essenceCore';
export { RED_CLOAK } from './redCloak';
export { SCYTHE } from './scythe';
export { PURPLE_BUFF } from './purpleBuff';
export { SEA_HALBERD } from './seaHalberd';
export { SHEEP_STICK } from './sheepStick';
export { RETRIBUTION } from './retribution';
export { REVITALIZE } from './revitalize';
export { BLANGKON } from './blangkon';
export { JIMAT } from './jimat';
export { KERIS } from './keris';
export { OFFERING } from './offering';
export { ORACLE } from './oracle';
export { BERSERKER_FURY } from './berserkerFury';
export { BLACK_SASH } from './blackSash';
export { BLADE_ARMOR } from './bladeArmor';
export { BLADE_OF_DESPAIR } from './bladeOfDespair';
export { DEMON_HUNTER_SWORD } from './demonHunterSword';
export { DIVINE_GLAIVE } from './divineGlaive';
export { DOMINANCE_ICE } from './dominanceIce';
export { GLOWING_WAND } from './glowingWand';
export { GOLDEN_STAFF } from './goldenStaff';
export { GUARDIAN_HELMET } from './guardianHelmet';
export { HAAS_CLAW } from './haasClaw';
export { SPELLBLADE_TALISMAN } from './spellbladeTalisman';
export { THIEF_TOOL } from './thiefTool';
export { THUNDER_BELT } from './thunderBelt';
export { WAR_AXE } from './warAxe';
export { WINTER_CROWN } from './winterCrown';

// Every item in the game. A new item is a new module plus one entry here.
export const ITEMS: Record<string, ItemDef> = Object.fromEntries([keris, blangkon, jimat, offering, blackSash, redCloak, scythe, iceLongbow, essenceCore, warAxe, haasClaw, goldenStaff, bladeOfDespair, berserkerFury, demonHunterSword, seaHalberd, iceQueenWand, glowingWand, holyCrystal, divineGlaive, winterCrown, dominanceIce, antiqueCuirass, guardianHelmet, bladeArmor, thunderBelt, oracle, ancientWrath, spellbladeTalisman, purpleBuff, sheepStick, thiefTool, aegis, inspire, purify, retribution, revitalize].map((i) => [i.id, i]));

// Equipment: the items no trait owns. Monster rounds drop them; they work on anyone.
export const EQUIPMENT: string[] = Object.values(ITEMS)
  .filter((i) => !i.trait && !i.basic && !i.exclusive)
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
