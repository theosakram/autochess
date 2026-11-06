import { MAX_ITEMS_PER_UNIT } from './config';
import type { Loc, Player, Star, Unit } from './types';

const MAX_STAR = 3;

// 1★ copies a unit is made of; what goes back to the pool when it leaves play.
export const copiesOf = (u: Unit) => 3 ** (u.star - 1);

export function slotsOf(p: Player, area: Loc['area']): (Unit | null)[] {
  return area === 'bench' ? p.bench : p.board;
}

// Board copies come first so a merge keeps the unit fielded.
export function findCopies(p: Player, defId: string, star: Star): Loc[] {
  const locs: Loc[] = [];
  for (const area of ['board', 'bench'] as const) {
    slotsOf(p, area).forEach((u, index) => {
      if (u && u.defId === defId && u.star === star) locs.push({ area, index });
    });
  }
  return locs;
}

// Removes a copy that's being merged into `keeper`; its items move over while there's room
// (the rest go back to the inventory on the next sync).
export function absorb(p: Player, keeper: Unit, loc: Loc): void {
  const gone = slotsOf(p, loc.area)[loc.index]!;
  for (const it of p.items) {
    if (it.holder !== gone.uid) continue;
    if (p.items.filter((i) => i.holder === keeper.uid).length < MAX_ITEMS_PER_UNIT) it.holder = keeper.uid;
  }
  for (const o of p.mistOrbs ?? []) {
    if (o.holder === gone.uid && !p.mistOrbs!.some((x) => x.holder === keeper.uid)) o.holder = keeper.uid;
  }
  slotsOf(p, loc.area)[loc.index] = null;
}

// Raises a unit's star by merging, and logs it for traits that react to merges (see syncPlayer).
export function promote(p: Player, keeper: Unit, star: Star): void {
  keeper.star = star;
  (p.promotions ??= []).push({ defId: keeper.defId, star });
}

// Combine every set of three same-star copies, cascading 1★ -> 2★ -> 3★.
export function mergeUnits(p: Player, defId: string): void {
  for (let star = 1; star < MAX_STAR; star++) {
    let copies = findCopies(p, defId, star as Star);
    while (copies.length >= 3) {
      const [keep, ...rest] = copies;
      const keeper = slotsOf(p, keep.area)[keep.index]!;
      for (const loc of rest.slice(0, 2)) absorb(p, keeper, loc);
      promote(p, keeper, (star + 1) as Star);
      copies = findCopies(p, defId, star as Star);
    }
  }
}
