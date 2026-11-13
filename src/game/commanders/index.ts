import { EQUIPMENT, ITEMS } from '../items';
import { BOARD_COLS, BOARD_ROWS, CARD_OFFER_SIZE } from '../config';
import { nextInt, shuffle } from '../rng';
import type { GameState, Loc, Player } from '../types';
import { UNIT_BY_ID } from '../units';
import { addXp } from '../player';
import { checkChestTriggers, spendFortunes } from '../powerCards';
import { payEcho } from '../essence';
import { alice } from './alice';
import { amon } from './amon';
import { angela } from './angela';
import { cyclops } from './cyclops';
import { dyroth } from './dyroth';
import { guiness } from './guiness';
import { fanny } from './fanny';
import { freya } from './freya';
import { johnson } from './johnson';
import { kaela } from './kaela';
import { kagura } from './kagura';
import { kenzo } from './kenzo';
import { lukas } from './lukas';
import { lunox } from './lunox';
import { luoyi } from './luoyi';
import { miya } from './miya';
import { nana } from './nana';
import { ruby } from './ruby';
import { minos } from './minos';
import { katarina } from './katarina';
import { lung } from './lung';
import { pacquiao } from './pacquiao';
import { zhuyong } from './zhuyong';
import { aurora } from './aurora';
import { harley } from './harley';
import { moscow } from './moscow';
import { vex } from './vex';
import type { BeastPower, CommanderDef, CommanderPower } from './types';
import type { Term } from './terms';

export type { DuelPower, AltarPower, BeastPower, BloodPower, BoostPower, CommanderDef, EnhancePower, CommanderPower, EchoPower, EssencePower, HurtGoldPower, IceArrowPower, JohnniePower, LoveBeamPower, MirrorBarPower, RallyPower, StarGoldPower, SurvivorGoldPower, TrovePower, ProtectPower, TreasurePower, FrostPower, IdlePrizePower, TierShopPower, RitualPower, LadderPower, TwilightPower, WardPower } from './types';
export { ALICE } from './alice';
export { AMON } from './amon';
export { ANGELA } from './angela';
export { CYCLOPS } from './cyclops';
export { DYROTH } from './dyroth';
export { GUINESS } from './guiness';
export { FANNY } from './fanny';
export { enhanceValues, FREYA } from './freya';
export { JOHNSON } from './johnson';
export { KAELA } from './kaela';
export { KAGURA } from './kagura';
export { KENZO } from './kenzo';
export { LUKAS } from './lukas';
export { LUNOX } from './lunox';
export { LUO_YI } from './luoyi';
export { MIYA } from './miya';
export { NANA } from './nana';
export { RUBY } from './ruby';
export { MINOS } from './minos';
export { KATARINA } from './katarina';
export { LUNG } from './lung';
export { PACQUIAO } from './pacquiao';
export { ZHU_YONG } from './zhuyong';
export { AURORA } from './aurora';
export { HARLEY } from './harley';
export { MOSCOW } from './moscow';
export { VEX } from './vex';
export { term, type Term } from './terms';

export const COMMANDERS: Record<string, CommanderDef> = Object.fromEntries([lukas, kagura, angela, kenzo, nana, kaela, ruby, dyroth, lunox, miya, alice, luoyi, johnson, amon, freya, cyclops, guiness, minos, katarina, lung, pacquiao, zhuyong, aurora, harley, moscow, vex, fanny].map((c) => [c.id, c]));

// Every commander's glossary terms, by id (see terms.ts).
export const TERMS: Record<string, Term> = Object.assign({}, ...Object.values(COMMANDERS).map((c) => c.terms ?? {}));

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
// `pickGold`, `pickItem`, `pickChest` and `startItems` are left out: they're paid once, on the pick.
export function powersOf(p: Player): Omit<CommanderPower, 'pickGold' | 'pickItem' | 'pickChest' | 'startItems' | 'pickXp' | 'pickMirrors' | 'pickFreeHeroes' | 'startChests' | 'startEnhancers' | 'pickEquipment' | 'levelHero' | 'pickGloves'> {
  const { pickGold: _gold, pickItem: _item, pickChest: _chest, startItems: _start, pickXp: _xp, pickMirrors: _mirrors, pickFreeHeroes: _free, startChests: _startChests, startEnhancers: _enh, pickEquipment: _eq, levelHero: _lh, pickGloves: _gl, ...merged } = Object.assign({}, ...commanderPowers(p)) as CommanderPower;
  return merged;
}

// This player's beast, if any power grants one.
export const beastOf = (p: Player): BeastPower | null => powersOf(p).beast ?? null;

// Hero marks: each is its own pick, made while its power works for the player. They can sit on the
// same hero or on different ones (shield the tank, boost the carry).
export type MarkKind = 'ward' | 'boost' | 'halo' | 'halo2' | 'iceArrow' | 'cable';
type Powers = ReturnType<typeof powersOf>;
export const MARKS: Record<MarkKind, { icon: string; name: string; action: string; available: (pw: Powers) => boolean }> = {
  ward: { icon: '☂️', name: 'Umbrella', action: 'Shield with your umbrella', available: (pw) => !!pw.ward },
  boost: { icon: '🌂', name: 'Umbrella Dance', action: 'Dance with your umbrella', available: (pw) => !!pw.boost },
  halo: { icon: '😇', name: 'Halo', action: 'Protect with your halo', available: (pw) => (pw.protect?.picks ?? 0) >= 1 },
  halo2: { icon: '😇', name: 'Second Halo', action: 'Protect with your second halo', available: (pw) => (pw.protect?.picks ?? 0) >= 2 },
  iceArrow: { icon: '❄️', name: 'Ice Arrow Blessing', action: 'Give the Ice Arrow Blessing', available: (pw) => !!pw.iceArrow },
  cable: { icon: '🔗', name: 'Steel Cable', action: 'Tie your steel cable', available: (pw) => !!pw.cable },
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
  const { pickGold = 0, pickItem, pickChest = 0, startItems = [], pickXp = 0, pickMirrors = 0, pickFreeHeroes = 0, startChests = 0, startEnhancers = 0, pickEquipment = 0, levelHero, pickGloves = [] } = cardFace(p, cardId).power;
  if (pickGloves.length) (p.gloves ??= []).push(...pickGloves); // Pacquiao's card
  // Lung's card: one random hero of the cost, handed over at each level (as Neon Zenith's are).
  if (levelHero) {
    const pool = Object.values(UNIT_BY_ID).filter((u) => u.tier === levelHero.tier && u.shop !== false && !u.piece);
    const unit = pool[nextInt(state, pool.length)].id;
    (p.chestTriggers ??= []).push(...levelHero.levels.map((level) => ({ level, unit })));
    checkChestTriggers(state, p);
  }
  // Minos: Enhancement Charges (added to any held), and random equipment.
  if (startEnhancers) p.enhancers = (p.enhancers ?? 0) + startEnhancers;
  for (let k = 0; k < pickEquipment; k++) p.items.push({ uid: state.nextUid++, id: EQUIPMENT[nextInt(state, EQUIPMENT.length)], tier: 1, holder: null });
  p.gold += pickGold;
  if (pickFreeHeroes) p.freeHeroes = (p.freeHeroes ?? 0) + pickFreeHeroes;
  if (startChests) addChests(p, startChests);
  if (pickMirrors) p.mirrors = (p.mirrors ?? 0) + pickMirrors;
  if (pickXp) addXp(p, pickXp);
  for (const id of [...(pickItem ? [pickItem] : []), ...startItems]) p.items.push({ uid: state.nextUid++, id, tier: 1, holder: null });
  if (pickChest) addChests(p, pickChest);
  // Lunox's card on another commander: the Twilight Blessing comes with it.
  grantTwilight(p);
  // Luo Yi's card: its first copy.
  payEcho(state, p);
}

// Hands over what a commander's innate power gives once, when it's picked (Ruby's Cloak and Scythe).
export function payCommander(state: GameState, p: Player): void {
  const innate = COMMANDERS[p.commander!].innate;
  for (const id of innate.startItems ?? []) p.items.push({ uid: state.nextUid++, id, tier: 1, holder: null });
  if (innate.startChests) addChests(p, innate.startChests);
  if (innate.startEnhancers) p.enhancers = (p.enhancers ?? 0) + innate.startEnhancers;
  // Lunox: the Twilight Blessing is his innate power, there from the start.
  grantTwilight(p);
}

// Lunox's Twilight Blessing, once a game, with its gold: handed out now, placed later.
function grantTwilight(p: Player): void {
  const tw = powersOf(p).twilight;
  if (!tw || p.twilight) return;
  p.twilight = { holder: null, trait: null };
  p.gold += tw.gold;
}

// Equipment Chests waiting to be opened (see inventory.openChest). They don't count toward an item's chest limit.
const addChests = (p: Player, n: number) => ((p.chests ??= { kills: 0, earned: 0, waiting: 0 }).waiting += n);

// The one place a player loses hp (a lost fight). Nana's powers: damage taken pays gold, and a lethal hit
// may leave them at 1 HP instead.
export function hurtPlayer(p: Player, damage: number): void {
  if (damage <= 0) return;
  // Rock Solid: the commander shield soaks it first.
  const soak = Math.min(p.shield ?? 0, damage);
  if (soak) {
    p.shield! -= soak;
    spendFortunes(p, soak); // Shield of Fortune's shield goes first
  }
  damage -= soak;
  if (damage <= 0) return;
  p.hp -= damage;
  const pw = powersOf(p);
  if (pw.hurtGold) {
    const h = pw.hurtGold;
    const hurt = (p.hurt ??= { taken: 0, paid: 0 });
    hurt.taken += damage;
    while (hurt.paid < h.times && hurt.taken >= (hurt.paid + 1) * h.every) {
      hurt.paid++;
      p.gold += h.gold;
      if (hurt.paid === h.times && h.chest) addChests(p, 1);
    }
  }
  if (p.hp <= 0 && (p.deathsSaved ?? 0) < (pw.deathSaves ?? 0)) {
    p.hp = 1;
    p.deathsSaved = (p.deathsSaved ?? 0) + 1;
  }
}

// The cards offered on the card round: the player's own commander's card, then random others.
export function offerCards(state: GameState, p: Player): string[] {
  if (!p.commander) return [];
  const others = shuffle(state, Object.keys(COMMANDERS).filter((id) => id !== p.commander));
  return [p.commander, ...others].slice(0, CARD_OFFER_SIZE);
}

// Swaps one offered card for another not on offer. Each slot gets one reroll.
export function rerollCard(state: GameState, p: Player, slot: number): string | null {
  if (!p.cardOffer?.[slot]) return 'No card there';
  if (p.cardRerolled?.[slot]) return 'That card was already rerolled';
  const pool = Object.keys(COMMANDERS).filter((id) => !p.cardOffer!.includes(id));
  if (pool.length === 0) return 'No other cards left';
  p.cardOffer[slot] = pool[nextInt(state, pool.length)];
  (p.cardRerolled ??= [])[slot] = true;
  return null;
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
