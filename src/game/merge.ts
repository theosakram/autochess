import { MAX_ITEMS_PER_UNIT } from './config';
import type { Loc, Player, Star, Unit } from './types';
import { UNIT_BY_ID } from './units';

const MAX_STAR = 3;

// Same-star copies that merge into one of the next star (3, or more for some units).
export const mergeSize = (defId: string) => UNIT_BY_ID[defId]?.mergeSize ?? 3;

// 1★ copies a unit is made of; what goes back to the pool when it leaves play.
export const copiesOf = (u: Unit) => u.copies ?? mergeSize(u.defId) ** (u.star - 1);

// Of those, the ones that came out of the pool (and go back to it).
export const pooledOf = (u: Unit) => copiesOf(u) - (u.shortfall ?? 0);

// Owning this many 1★ copies means the next one completes a star-up.
export const nearMerge = (p: Player, defId: string) => findCopies(p, defId, 1).length >= mergeSize(defId) - 1;

// Alice's Blood Pact: copies needed for 1, 2, 3 and "4" stars on a blessed hero (it can't go past the last).
export const BLOOD_STEPS = [1, 3, 9, 13];
const bloodStar = (copies: number): Star => (copies >= BLOOD_STEPS[2] ? 3 : copies >= BLOOD_STEPS[1] ? 2 : 1);

// A blessed hero type: every copy on board and bench piles into one (board first), up to the last step,
// plus `extra` copies from nowhere (the Pact's gift). Copies past the cap stay as they are.
export function bloodMerge(p: Player, defId: string, extra = 0): void {
  const locs = findAll(p, defId);
  if (!locs.length) return;
  const keeper = slotsOf(p, locs[0].area)[locs[0].index]!;
  const before = keeper.star;
  let copies = copiesOf(keeper) + extra;
  for (const loc of locs.slice(1)) {
    const u = slotsOf(p, loc.area)[loc.index]!;
    if (copies + copiesOf(u) > BLOOD_STEPS[BLOOD_STEPS.length - 1]) continue;
    copies += copiesOf(u);
    absorb(p, keeper, loc);
  }
  keeper.copies = Math.min(copies, BLOOD_STEPS[BLOOD_STEPS.length - 1]);
  const star = bloodStar(keeper.copies);
  if (star > before) promote(p, keeper, star);
}

// A blessed hero of this type with room for one more copy (it takes the copy straight in, bench full or not).
export function bloodRoom(p: Player, defId: string): Unit | null {
  if (!p.blood?.blessed.includes(defId)) return null;
  const u = [...p.board, ...p.bench].find((x) => x?.defId === defId && x.copies !== undefined);
  return u && u.copies! < BLOOD_STEPS[BLOOD_STEPS.length - 1] ? u : null;
}

function findAll(p: Player, defId: string): Loc[] {
  const locs: Loc[] = [];
  for (const area of ['board', 'bench'] as const) {
    slotsOf(p, area).forEach((u, index) => {
      if (u && u.defId === defId) locs.push({ area, index });
    });
  }
  return locs;
}

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
  // Copies the pool never gave carry into the merged hero, so it never hands them back.
  if (gone.shortfall) keeper.shortfall = (keeper.shortfall ?? 0) + gone.shortfall;
  if (gone.merc) keeper.merc = true; // Rogue Mercenary's buff stays with the hero
  if (gone.signature) keeper.signature = true; // so does a hero card's
  for (const it of p.items) {
    if (it.holder !== gone.uid) continue;
    if (p.items.filter((i) => i.holder === keeper.uid).length < MAX_ITEMS_PER_UNIT) it.holder = keeper.uid;
  }
  for (const o of p.mistOrbs ?? []) {
    if (o.holder === gone.uid && !p.mistOrbs!.some((x) => x.holder === keeper.uid)) o.holder = keeper.uid;
  }
  // Lunox's blessing stays with the hero it's on, merged up.
  if (p.twilight?.holder === gone.uid) p.twilight.holder = keeper.uid;
  slotsOf(p, loc.area)[loc.index] = null;
}

// Raises a unit's star by merging, and logs it for traits that react to merges (see syncPlayer).
export function promote(p: Player, keeper: Unit, star: Star): void {
  keeper.star = star;
  (p.promotions ??= []).push({ defId: keeper.defId, star });
}

// Combine every full set of same-star copies (mergeSize), cascading 1★ -> 2★ -> 3★.
export function mergeUnits(p: Player, defId: string): void {
  if (p.blood?.blessed.includes(defId)) return bloodMerge(p, defId);
  const size = mergeSize(defId);
  for (let star = 1; star < MAX_STAR; star++) {
    let copies = findCopies(p, defId, star as Star);
    while (copies.length >= size) {
      const [keep, ...rest] = copies;
      const keeper = slotsOf(p, keep.area)[keep.index]!;
      for (const loc of rest.slice(0, size - 1)) absorb(p, keeper, loc);
      promote(p, keeper, (star + 1) as Star);
      copies = findCopies(p, defId, star as Star);
    }
  }
}
