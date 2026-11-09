import { applyAction } from './actions';
import { interestBank, playEssence, placeMarks, playAltars, playBlood, playFreya, playJohnnie, playTrove, playTwilight, useOrb } from './bot';
import { COMMANDERS } from './commanders';
import { REROLL_COST, STAR_MULT, stageRound } from './config';
import { equipBlock } from './inventory';
import { isItemCard, ITEMS } from './items';
import { mergeSize } from './merge';
import { levelUpCost } from './player';
import { nextInt } from './rng';
import { tileSeating, traitCounts, traitLevel } from './traits';
import type { GameState, Player, Unit } from './types';
import { UNIT_BY_ID } from './units';
import { shopPrice } from './shop';

// Normal bot: plays toward the strongest board it can make from what it owns. Every decision (what to buy,
// sell, field) compares "best team" values: each hero's worth by cost and stars, plus its traits'
// breakpoints. It keeps an interest bank, levels on a curve, and rolls down when it's losing.
// Tune the numbers here with `bun run bots`.
export const NORMAL_BOT = {
  traitLevel: 3, // worth of one trait breakpoint, in "hero power" (a 1★ 2-cost is 3)
  pairBonus: 0.6, // extra worth of a copy that makes a pair (share of its power)
  buyMin: 0.4, // a buy must be worth at least this
  // Level to reach by each stage (index = stage): it pays for XP below the bank to stay on this curve.
  levelCurve: [0, 4, 6, 7, 8, 9, 10],
  rollHp: 50, // below this HP it spends its bank rolling
  allInHp: 25, // below this, it spends everything
  richGold: 50, // above this, it rolls down to the bank at any HP
};
const B = NORMAL_BOT;

type Card = { defId: string; star: number };

const power = (defId: string, star: number) => (UNIT_BY_ID[defId].tier + 1) * STAR_MULT[star - 1];
const owned = (p: Player) => [...p.board, ...p.bench].filter((u): u is Unit => u !== null && !UNIT_BY_ID[u.defId].piece);

// A full set of a kind (mergeSize) merges into one of the next star, as buying does.
function merged(cards: Card[]): Card[] {
  const out = cards.slice();
  for (let again = true; again; ) {
    again = false;
    for (const c of out) {
      if (c.star >= 3) continue;
      const same = out.filter((d) => d.defId === c.defId && d.star === c.star);
      if (same.length < mergeSize(c.defId)) continue;
      for (const d of same.slice(0, mergeSize(c.defId))) out.splice(out.indexOf(d), 1);
      out.push({ defId: c.defId, star: c.star + 1 });
      again = true;
      break;
    }
  }
  return out;
}

function teamValue(p: Player, team: Card[]): number {
  let v = 0;
  for (const c of team) v += power(c.defId, c.star);
  const counts = traitCounts(
    team.map((c, i) => ({ uid: -1 - i, defId: c.defId, star: c.star as 1 })),
    p.orb,
  );
  for (const [t, n] of Object.entries(counts)) v += traitLevel(t, n) * B.traitLevel;
  return v;
}

// The best `level`-sized team from these cards: greedy, each step adding whichever adds the most.
// Free-slot heroes come along without taking a place.
function bestTeam(p: Player, cards: Card[]): { team: Card[]; value: number } {
  const team: Card[] = cards.filter((c) => UNIT_BY_ID[c.defId].freeSlot);
  const rest = cards.filter((c) => !UNIT_BY_ID[c.defId].freeSlot);
  let value = teamValue(p, team);
  for (let placed = 0; placed < p.level && rest.length; placed++) {
    let best = -1;
    let bestValue = -Infinity;
    rest.forEach((c, i) => {
      const v = teamValue(p, [...team, c]);
      if (v > bestValue) [best, bestValue] = [i, v];
    });
    team.push(rest.splice(best, 1)[0]);
    value = bestValue;
  }
  return { team, value };
}

const cardsOf = (units: Unit[]): Card[] => units.map((u) => ({ defId: u.defId, star: u.star }));

// How much a new copy of `defId` adds: the best team with it, minus without it, plus a little for a pair.
function buyWorth(p: Player, defId: string): number {
  const mine = cardsOf(owned(p));
  const now = bestTeam(p, merged(mine)).value;
  const after = bestTeam(p, merged([...mine, { defId, star: 1 }])).value;
  const pair = mine.some((c) => c.defId === defId && c.star === 1) ? B.pairBonus * power(defId, 1) : 0;
  return after - now + pair;
}

// How much keeping this unit is worth: what the team loses without it (and its pair value).
function keepWorth(p: Player, u: Unit): number {
  const mine = owned(p);
  const all = bestTeam(p, merged(cardsOf(mine))).value;
  const without = bestTeam(p, merged(cardsOf(mine.filter((x) => x !== u)))).value;
  const pair = u.star < 3 && mine.some((x) => x !== u && x.defId === u.defId && x.star === u.star) ? B.pairBonus * power(u.defId, u.star) : 0;
  return all - without + pair;
}

const locOf = (p: Player, u: Unit) => {
  const b = p.board.indexOf(u);
  return b >= 0 ? { area: 'board' as const, index: b } : { area: 'bench' as const, index: p.bench.indexOf(u) };
};

// The least useful hero on the bench, to make room.
function sellWorst(state: GameState, p: Player, below: number): boolean {
  const bench = p.bench.filter((u): u is Unit => u !== null && !UNIT_BY_ID[u.defId].piece);
  if (!bench.length) return false;
  const [worst, worth] = bench.map((u) => [u, keepWorth(p, u)] as const).sort((a, b) => a[1] - b[1])[0];
  if (worth >= below) return false;
  return applyAction(state, p.id, { type: 'sell', from: locOf(p, worst) }).ok;
}

// One pass over the shop: buy what's worth it, as long as `reserve` gold stays.
function shopPass(state: GameState, p: Player, reserve: number): void {
  for (let i = 0; i < p.shop.length; i++) {
    const id = p.shop[i];
    if (!id) continue;
    if (isItemCard(id)) {
      applyAction(state, p.id, { type: 'buy', slot: i });
      continue;
    }
    const cost = shopPrice(p, i);
    if (p.gold < cost) continue;
    const worth = buyWorth(p, id);
    // A copy that completes a star-up is worth dipping into the bank for.
    const triple = owned(p).filter((u) => u.defId === id && u.star === 1).length >= mergeSize(id) - 1;
    if (worth < B.buyMin || (!triple && p.gold - cost < reserve)) continue;
    if (!applyAction(state, p.id, { type: 'buy', slot: i }).ok && sellWorst(state, p, worth)) applyAction(state, p.id, { type: 'buy', slot: i });
  }
}

function pickCard(state: GameState, p: Player): void {
  if (!p.cardOffer?.length) return;
  // Its own commander's card (the self face) when offered.
  const card = p.cardOffer.includes(p.commander!) ? p.commander! : p.cardOffer[nextInt(state, p.cardOffer.length)];
  applyAction(state, p.id, { type: 'pickCard', card });
}

// Damage type of a hero: magic when it hits harder with magic attack.
const isMagic = (defId: string) => UNIT_BY_ID[defId].ap > UNIT_BY_ID[defId].atk;
const fielded = (p: Player) => p.board.filter((u): u is Unit => u !== null && !UNIT_BY_ID[u.defId].piece);
const ranked = (units: Unit[], score: (u: Unit) => number) => units.slice().sort((a, b) => score(b) - score(a));
const carryScore = (u: Unit) => power(u.defId, u.star) * (UNIT_BY_ID[u.defId].range >= 2 ? 1.25 : 1);
const tankScore = (u: Unit) => {
  const d = UNIT_BY_ID[u.defId];
  return (d.range <= 1 ? 2 : 1) * (d.hp * STAR_MULT[u.star - 1] + (d.armor + d.mr) * 4);
};

// Item offers: what the main carry type lacks, else armor for the tank, else the carry type again.
function pickItems(state: GameState, p: Player): void {
  while (p.itemOffer?.length) {
    const offer = p.itemOffer;
    const team = fielded(p).length ? fielded(p) : owned(p);
    const magicPower = team.filter((u) => isMagic(u.defId)).reduce((n, u) => n + carryScore(u), 0);
    const physPower = team.filter((u) => !isMagic(u.defId)).reduce((n, u) => n + carryScore(u), 0);
    const main = magicPower > physPower ? ['magic', 'hybrid'] : ['physical', 'hybrid'];
    const held = (groups: string[]) => p.items.filter((it) => groups.includes(ITEMS[it.id].group ?? '')).length;
    const want = held(main) <= held(['armor']) + 1 ? main : ['armor'];
    const pick = offer.find((id) => want.includes(ITEMS[id].group ?? '')) ?? offer.find((id) => main.includes(ITEMS[id].group ?? '')) ?? offer[0];
    applyAction(state, p.id, { type: 'pickItem', item: pick });
  }
}

// The team on the board: the best `level` heroes owned, tanks in front (centre out), ranged at the back.
function field(state: GameState, p: Player): void {
  const units = owned(p);
  const cards = cardsOf(units);
  const { team } = bestTeam(p, cards);
  // Map the chosen cards back to units (same type and star; each unit once).
  const pool = units.slice();
  const chosen: Unit[] = [];
  for (const c of team) {
    const i = pool.findIndex((u) => u.defId === c.defId && u.star === c.star);
    if (i >= 0) chosen.push(pool.splice(i, 1)[0]);
  }
  const keep = new Set(chosen);
  // Off the board: whoever isn't chosen (bench full: sell the weakest of them instead).
  p.board.forEach((u, i) => {
    if (!u || keep.has(u) || UNIT_BY_ID[u.defId].piece) return;
    const free = p.bench.indexOf(null);
    if (free >= 0) applyAction(state, p.id, { type: 'move', from: { area: 'board', index: i }, to: { area: 'bench', index: free } });
    else applyAction(state, p.id, { type: 'sell', from: { area: 'board', index: i } });
  });
  // Onto the board: the chosen from the bench, anywhere free for now.
  for (const u of chosen) {
    const at = p.bench.indexOf(u);
    if (at < 0) continue;
    const to = p.board.indexOf(null);
    if (to < 0) break;
    applyAction(state, p.id, { type: 'move', from: { area: 'bench', index: at }, to: { area: 'board', index: to } });
  }
  arrange(state, p);
}

const COLS = 7;
const CENTRE_OUT = [3, 2, 4, 1, 5, 0, 6];

function arrange(state: GameState, p: Player): void {
  const on = fielded(p);
  const pieceCells = new Set(p.board.flatMap((u, i) => (u && UNIT_BY_ID[u.defId].piece ? [i] : [])));
  const rows = [0, 1, 2].map((r) => CENTRE_OUT.map((c) => r * COLS + c).filter((i) => !pieceCells.has(i)));
  const melee = ranked(on.filter((u) => UNIT_BY_ID[u.defId].range <= 1), tankScore);
  const ranged = ranked(on.filter((u) => UNIT_BY_ID[u.defId].range >= 2), carryScore);
  const target = new Map<Unit, number>();
  const take = (u: Unit, order: number[][]) => {
    for (const row of order) {
      const cell = row.find((i) => ![...target.values()].includes(i));
      if (cell !== undefined) return void target.set(u, cell);
    }
  };
  for (const u of melee) take(u, [rows[0], rows[1], rows[2]]);
  for (const u of ranged) take(u, [rows[2], rows[1], rows[0]]);
  for (const [u, cell] of target) {
    const from = p.board.indexOf(u);
    if (from !== cell) applyAction(state, p.id, { type: 'move', from: { area: 'board', index: from }, to: { area: 'board', index: cell } });
  }
}

// Items: off heroes that left the board, then each loose one to whoever wants it most: damage items on the
// carry of their type, armor on the tank, trait items on that trait's best member.
function equip(state: GameState, p: Player): void {
  const on = fielded(p);
  const onIds = new Set(on.map((u) => u.uid));
  for (const it of p.items) if (it.holder !== null && !onIds.has(it.holder)) applyAction(state, p.id, { type: 'unequip', item: it.uid });
  for (const it of p.items.filter((i) => i.holder === null)) {
    const def = ITEMS[it.id];
    const carries = ranked(on, carryScore);
    let order: Unit[];
    if (def.trait) order = [...ranked(on.filter((u) => UNIT_BY_ID[u.defId].traits.includes(def.trait!)), carryScore), ...carries];
    else if (def.group === 'armor' || def.kind === 'defense') order = ranked(on, tankScore);
    else if (def.group === 'magic') order = [...carries.filter((u) => isMagic(u.defId)), ...carries];
    else if (def.group === 'physical') order = [...carries.filter((u) => !isMagic(u.defId)), ...carries];
    else order = carries;
    const unit = order.find((u) => !equipBlock(p, it, u));
    if (unit) applyAction(state, p.id, { type: 'equip', item: it.uid, unit: unit.uid });
  }
}

export function normalBot(state: GameState, p: Player): void {
  if (!p.commander) {
    const ids = Object.keys(COMMANDERS);
    applyAction(state, p.id, { type: 'pickCommander', commander: ids[nextInt(state, ids.length)] });
  }
  pickCard(state, p);
  if (p.powerOffer) applyAction(state, p.id, { type: 'pickPower', card: p.powerOffer.cards[0] });
  if (p.factionOrbOffer) applyAction(state, p.id, { type: 'pickFactionOrb', trait: p.factionOrbOffer[0] });
  pickItems(state, p);
  playTrove(state, p);
  playJohnnie(state, p);
  playAltars(state, p);
  playTwilight(state, p);
  playBlood(state, p);

  const bank = interestBank();
  const { stage } = stageRound(state.round);
  // Level up on the curve (or with gold to spare past the bank).
  const behind = () => p.level < (B.levelCurve[stage] ?? 10);
  for (let cost = levelUpCost(p); cost !== null && p.gold >= cost && (p.gold - cost >= bank || behind()); cost = levelUpCost(p)) {
    if (!behind() && p.gold - cost < bank) break;
    if (behind() && p.gold - cost < Math.min(bank, 10) && p.hp > B.rollHp) break;
    applyAction(state, p.id, { type: 'levelUp' });
  }

  // How much to keep: the bank normally, less when it's losing (or rich).
  const reserve = p.hp <= B.allInHp ? 0 : p.hp <= B.rollHp || p.gold > B.richGold ? Math.min(bank, p.gold) : bank;
  const rolling = p.hp <= B.rollHp || p.gold > B.richGold;
  shopPass(state, p, rolling ? reserve : Math.min(reserve, Math.max(0, p.gold - 4)));
  if (rolling) {
    for (let rolls = 0; rolls < 40 && p.gold - REROLL_COST >= reserve; rolls++) {
      applyAction(state, p.id, { type: 'reroll' });
      shopPass(state, p, reserve);
    }
  }

  field(state, p);
  playEssence(state, p);
  useOrb(state, p);
  playFreya(state, p);
  for (const [from, to] of tileSeating(p.board, p.orb)) {
    applyAction(state, p.id, { type: 'move', from: { area: 'board', index: from }, to: { area: 'board', index: to } });
  }
  equip(state, p);
  placeMarks(state, p);
}
