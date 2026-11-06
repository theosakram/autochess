import { ITEMS } from '../items';
import { BOARD_COLS, BOARD_ROWS, CARD_OFFER_SIZE } from '../config';
import { shuffle } from '../rng';
import type { GameState, Loc, Player } from '../types';
import { UNIT_BY_ID } from '../units';
import { angela } from './angela';
import { kagura } from './kagura';
import { kenzo } from './kenzo';
import { lukas } from './lukas';
import type { BeastPower, CommanderDef, CommanderPower } from './types';

export type { BeastPower, BoostPower, CommanderDef, CommanderPower, ProtectPower, WardPower } from './types';
export { ANGELA } from './angela';
export { KAGURA } from './kagura';
export { KENZO } from './kenzo';
export { LUKAS } from './lukas';

export const COMMANDERS: Record<string, CommanderDef> = Object.fromEntries([lukas, kagura, angela, kenzo].map((c) => [c.id, c]));

// The board piece a beast power puts on the board (see UnitDef.piece).
export const BEAST_PIECE = 'divinebeast';

// Names for the combat effects commanders deal, for the damage meter.
export const COMMANDER_EFFECTS: Record<string, { icon: string; name: string }> = {
  [BEAST_PIECE]: { icon: '🦁', name: 'Divine Beast' },
};

// The card `cardId` (a commander id) as it works for this player: its own commander's upgrade, or the
// other face (by default that commander's innate power).
export function cardFace(p: Player, cardId: string): { power: CommanderPower; desc: string; self: boolean } {
  const owner = COMMANDERS[cardId];
  const self = p.commander === cardId;
  if (self) return { power: owner.card.self, desc: owner.card.selfDesc, self };
  return { power: owner.card.other ?? owner.innate, desc: owner.card.otherDesc ?? owner.desc, self };
}

// Every power working for this player, in order: the commander's innate power, then its card.
export function commanderPowers(p: Player): CommanderPower[] {
  const powers: CommanderPower[] = [];
  if (p.commander) powers.push(COMMANDERS[p.commander].innate);
  if (p.commanderCard) powers.push(cardFace(p, p.commanderCard).power);
  return powers;
}

// Everything working for this player, merged (later powers override earlier ones, field by field).
// `pickGold` and `pickItem` are left out: they're paid once, on the pick.
export function powersOf(p: Player): Omit<CommanderPower, 'pickGold' | 'pickItem'> {
  const { pickGold: _gold, pickItem: _item, ...merged } = Object.assign({}, ...commanderPowers(p)) as CommanderPower;
  return merged;
}

// This player's beast, if any power grants one.
export const beastOf = (p: Player): BeastPower | null => powersOf(p).beast ?? null;

// Hero marks: each is its own pick, made while its power works for the player. They can sit on the
// same hero or on different ones (shield the tank, boost the carry).
export type MarkKind = 'ward' | 'boost' | 'halo' | 'halo2';
type Powers = ReturnType<typeof powersOf>;
export const MARKS: Record<MarkKind, { icon: string; name: string; action: string; available: (pw: Powers) => boolean }> = {
  ward: { icon: '☂️', name: 'Umbrella', action: 'Shield with your umbrella', available: (pw) => !!pw.ward },
  boost: { icon: '🌂', name: 'Umbrella Dance', action: 'Dance with your umbrella', available: (pw) => !!pw.boost },
  halo: { icon: '😇', name: 'Halo', action: 'Protect with your halo', available: (pw) => (pw.protect?.picks ?? 0) >= 1 },
  halo2: { icon: '😇', name: 'Second Halo', action: 'Protect with your second halo', available: (pw) => (pw.protect?.picks ?? 0) >= 2 },
};
export const MARK_KINDS = Object.keys(MARKS) as MarkKind[];

// The marks this player's powers let them place.
export const markKinds = (p: Player): MarkKind[] => MARK_KINDS.filter((k) => MARKS[k].available(powersOf(p)));

// The hero holding mark `kind`, if the player has its power and placed it.
export function markedUid(p: Player, kind: MarkKind): number | null {
  const mark = p.marks?.[kind];
  return mark && MARKS[kind].available(powersOf(p)) ? mark.uid : null;
}

// Angela's automatic protection: the fielded hero with the most items that isn't already under a halo
// (ties: higher star, then higher cost, then board order). Null without the power.
export function autoHalo(p: Player): number | null {
  if (!powersOf(p).protect) return null;
  const picked = new Set([markedUid(p, 'halo'), markedUid(p, 'halo2')]);
  // Item count, as slots: an item taking every slot (Thief Tool) counts as that many.
  const items = (uid: number) => p.items.reduce((n, i) => n + (i.holder === uid ? (ITEMS[i.id].slots ?? 1) : 0), 0);
  let best: { uid: number; rank: number[] } | null = null;
  for (const u of p.board) {
    if (!u || UNIT_BY_ID[u.defId].piece || picked.has(u.uid)) continue;
    const rank = [items(u.uid), u.star, UNIT_BY_ID[u.defId].tier];
    const k = best ? rank.findIndex((n, i) => n !== best!.rank[i]) : 0;
    if (!best || (k >= 0 && rank[k] > best.rank[k])) best = { uid: u.uid, rank };
  }
  return best?.uid ?? null;
}

// Every hero Angela protects: the halos placed, plus the automatic one.
export function protectedUids(p: Player): Set<number> {
  if (!powersOf(p).protect) return new Set();
  return new Set([markedUid(p, 'halo'), markedUid(p, 'halo2'), autoHalo(p)].filter((u) => u !== null));
}

// The mark icons a unit shows (its placed marks, and the automatic halo).
export function markIcons(p: Player, uid: number): string[] {
  const icons = MARK_KINDS.filter((k) => markedUid(p, k) === uid).map((k) => MARKS[k].icon);
  if (autoHalo(p) === uid) icons.push(MARKS.halo.icon);
  return icons;
}

// Keeps marks on the right units: gone without their power; when a marked unit is merged away, the
// mark moves to the copy it went into (same unit type, best star); gone if no copy is left.
export function syncMarks(p: Player): void {
  if (!p.marks) return;
  const units = [...p.board, ...p.bench].filter((u) => u !== null);
  for (const kind of MARK_KINDS) {
    const mark = p.marks[kind];
    if (!mark) continue;
    if (!MARKS[kind].available(powersOf(p))) {
      p.marks[kind] = null;
      continue;
    }
    if (units.some((u) => u.uid === mark.uid)) continue;
    const heir = units.filter((u) => u.defId === mark.defId).sort((a, b) => b.star - a.star)[0];
    p.marks[kind] = heir ? { uid: heir.uid, defId: heir.defId } : null;
  }
}

// Pays out what picking card `cardId` gives right away: its gold and its item.
export function payCard(state: GameState, p: Player, cardId: string): void {
  const { pickGold = 0, pickItem } = cardFace(p, cardId).power;
  p.gold += pickGold;
  if (pickItem) p.items.push({ uid: state.nextUid++, id: pickItem, tier: 1, holder: null });
}

// The cards offered on the card round: the player's own commander's card, then random others.
export function offerCards(state: GameState, p: Player): string[] {
  if (!p.commander) return [];
  const others = shuffle(state, Object.keys(COMMANDERS).filter((id) => id !== p.commander));
  return [p.commander, ...others].slice(0, CARD_OFFER_SIZE);
}

// Board rows (0 = front) the beast may stand on.
export const beastRows = (b: BeastPower): number[] => Array.from({ length: BOARD_ROWS }, (_, r) => r).filter((r) => b.frontRow || r > 0);

// Why a commander piece can't be at `to`, or null if it can. Pieces live on the board only.
export function pieceBlock(p: Player, defId: string, to: Loc): string | null {
  if (!UNIT_BY_ID[defId].piece) return null;
  if (to.area !== 'board') return `The ${UNIT_BY_ID[defId].name} stays on the board`;
  const beast = beastOf(p);
  if (defId === BEAST_PIECE && beast && !beastRows(beast).includes(Math.floor(to.index / BOARD_COLS))) {
    return `The ${UNIT_BY_ID[defId].name} can only stand on the back two rows`;
  }
  return null;
}

// Puts the beast on the board when a power grants one (back row, as central as it gets), and takes it
// away when none does. Run on every sync.
export function syncBeast(state: GameState, p: Player): void {
  const beast = beastOf(p);
  const at = p.board.findIndex((u) => u?.defId === BEAST_PIECE);
  if (!beast) {
    if (at >= 0) p.board[at] = null;
    return;
  }
  if (at >= 0) return;
  const back = BOARD_ROWS - 1;
  const order = [...beastRows(beast)].reverse().flatMap((r) => byCentre().map((c) => r * BOARD_COLS + c));
  let cell = order.find((i) => !p.board[i]);
  if (cell === undefined) {
    // Every allowed cell is taken: nudge the unit in the back-centre cell to the bench, or anywhere free.
    cell = back * BOARD_COLS + byCentre()[0];
    const bumped = p.board[cell]!;
    const bench = p.bench.indexOf(null);
    const free = p.board.indexOf(null);
    if (bench >= 0) p.bench[bench] = bumped;
    else if (free >= 0) p.board[free] = bumped;
    else return; // nowhere at all: it shows up once there's room
  }
  p.board[cell] = { uid: state.nextUid++, defId: BEAST_PIECE, star: 1 };
}

// Board columns, middle first.
const byCentre = () => Array.from({ length: BOARD_COLS }, (_, c) => c).sort((a, b) => Math.abs(a - (BOARD_COLS - 1) / 2) - Math.abs(b - (BOARD_COLS - 1) / 2) || a - b);
