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

// Combine every set of three same-star copies, cascading 1★ -> 2★ -> 3★.
export function mergeUnits(p: Player, defId: string): void {
  for (let star = 1; star < MAX_STAR; star++) {
    let copies = findCopies(p, defId, star as Star);
    while (copies.length >= 3) {
      const [keep, ...rest] = copies;
      for (const loc of rest.slice(0, 2)) slotsOf(p, loc.area)[loc.index] = null;
      slotsOf(p, keep.area)[keep.index]!.star = (star + 1) as Star;
      copies = findCopies(p, defId, star as Star);
    }
  }
}
