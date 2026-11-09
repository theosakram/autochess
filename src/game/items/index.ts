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
import { greatDragonSpear } from './greatDragonSpear';
import { supremeBlade } from './supremeBlade';
import { plunderersClaw } from './plunderersClaw';
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
export { ESSENCE_CORE, ESSENCE_CORE_STATS } from './essenceCore';
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
export { GREAT_DRAGON_SPEAR } from './greatDragonSpear';
export { giftDamage, SUPREME_BLADE } from './supremeBlade';
export { plunderDamage, PLUNDERERS_CLAW } from './plunderersClaw';
export { HAAS_CLAW } from './haasClaw';
export { SPELLBLADE_TALISMAN } from './spellbladeTalisman';
export { THIEF_TOOL } from './thiefTool';
export { THUNDER_BELT } from './thunderBelt';
export { WAR_AXE } from './warAxe';
export { WINTER_CROWN } from './winterCrown';

// Every base item in the game. A new item is a new module plus one entry here.
const BASE_ITEMS: ItemDef[] = [keris, blangkon, jimat, offering, blackSash, redCloak, scythe, iceLongbow, essenceCore, greatDragonSpear, supremeBlade, plunderersClaw, warAxe, haasClaw, goldenStaff, bladeOfDespair, berserkerFury, demonHunterSword, seaHalberd, iceQueenWand, glowingWand, holyCrystal, divineGlaive, winterCrown, dominanceIce, antiqueCuirass, guardianHelmet, bladeArmor, thunderBelt, oracle, ancientWrath, spellbladeTalisman, purpleBuff, sheepStick, thiefTool, aegis, inspire, purify, retribution, revitalize];

// --- Enhanced items ---
// An item with `enhanced` overrides has an enhanced version: the base with those changes, as an item of its own
// (id `<base>+`, named "Enhanced <name>" unless the overrides rename it). Everything that reads ITEMS works on it.
export { PASSIVES } from './passives';
export const ENHANCED_SUFFIX = '+';
export const enhancedId = (id: string) => id + ENHANCED_SUFFIX;
export function enhancedVariant(base: ItemDef): ItemDef | null {
  if (!base.enhanced) return null;
  return { ...base, name: `Enhanced ${base.name}`, ...base.enhanced, id: enhancedId(base.id), enhancedFrom: base.id, enhanced: undefined };
}

// Every item: the base items and their enhanced versions.
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [...BASE_ITEMS, ...BASE_ITEMS.flatMap((i) => enhancedVariant(i) ?? [])].map((i) => [i.id, i]),
);

// Whether an item (base) has an enhanced version; whether it is one; its base's id (itself for a base item).
export const canEnhance = (id: string) => !!ITEMS[id] && !ITEMS[id].enhancedFrom && !!ITEMS[enhancedId(id)];
export const isEnhanced = (id: string) => !!ITEMS[id]?.enhancedFrom;
export const baseItemOf = (id: string) => ITEMS[id]?.enhancedFrom ?? id;

// Turns an owned item into its enhanced version (same uid, tier and holder). False if it can't be (no enhanced
// version, or already enhanced).
export function enhanceItem(item: { id: string }): boolean {
  if (!canEnhance(item.id)) return false;
  item.id = enhancedId(item.id);
  return true;
}

// Equipment: the items no trait owns. Monster rounds drop them; they work on anyone. Base versions only: an
// enhanced one is only ever made from a base (see enhanceItem).
export const EQUIPMENT: string[] = BASE_ITEMS.filter((i) => !i.trait && !i.basic && !i.exclusive).map((i) => i.id);

// Basic items: also trait-free, but only from the round-2 pick (see BASIC_ITEM_ROUND).
export const BASIC_ITEMS: string[] = BASE_ITEMS.filter((i) => i.basic).map((i) => i.id);

// Shop slots can hold an upgrade card for an item instead of a unit.
const CARD = 'item:';
export const isItemCard = (slot: string) => slot.startsWith(CARD);
export const itemCard = (itemId: string) => CARD + itemId;
export const cardItem = (slot: string) => slot.slice(CARD.length);
