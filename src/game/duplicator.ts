import { EQUIPMENT, ITEMS } from './items';
import type { GameState, Player } from './types';

// The Equipment Duplicator (Copycat): an inventory item (Player.duplicators counts them). Used on one piece of
// equipment, it makes copies of it (same tier) into the inventory. Trait items (Gustiwana's, Cult of Fire's),
// basic items and exclusive items can't be copied: equipment only.
export const DUPLICATOR = {
  name: 'Equipment Duplicator',
  icon: '🧬',
  copies: 3,
  desc: 'Use it on a piece of equipment to make 3 copies of it. Trait items (like Gustiwana or Cult of Fire ones) and other special items can\'t be copied.',
};

export const canDuplicate = (id: string) => EQUIPMENT.includes(id);

// Why item `uid` can't be duplicated, or null.
export function duplicateBlock(p: Player, uid: number): string | null {
  if (!p.duplicators) return 'You have no Equipment Duplicator';
  const item = p.items.find((i) => i.uid === uid && !i.loan);
  if (!item) return 'Pick one of your items to copy';
  if (!canDuplicate(item.id)) return `The ${ITEMS[item.id].name} can't be copied`;
  return null;
}

// Uses one Equipment Duplicator on item `uid`: its copies go to the inventory. Returns an error, or null.
export function useDuplicator(state: GameState, p: Player, uid: number): string | null {
  const err = duplicateBlock(p, uid);
  if (err) return err;
  const item = p.items.find((i) => i.uid === uid)!;
  for (let k = 0; k < DUPLICATOR.copies; k++) p.items.push({ uid: state.nextUid++, id: item.id, tier: item.tier, holder: null });
  p.duplicators = p.duplicators! - 1 || undefined;
  return null;
}
