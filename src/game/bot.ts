import { bloodBlock } from './blood';
import { blessBlock } from './twilight';
import { applyAction } from './actions';
import { ALTAR_KEYS, altarStatus, offerBlock } from './altar';
import { COMMANDERS, markedUid, markKinds, powersOf, protectedUids } from './commanders';
import { MAX_INTEREST } from './config';
import { nextInt } from './rng';
import { equipBlock } from './inventory';
import { isItemCard } from './items';
import { boardCount, interest, levelUpCost } from './player';
import { orbOptions } from './orb';
import { tileSeating, traitCounts, traitLevel } from './traits';
import type { GameState, Player } from './types';
import { UNIT_BY_ID } from './units';
import { normalBot } from './botNormal';

export function runBot(state: GameState, p: Player): void {
  if (p.botLevel === 'normal') return normalBot(state, p);
  easyBot(state, p);
}

// Easy: buy whatever is affordable, field as much as the cap allows,
// take any trait tiles, level up whenever it can still keep max interest.
function easyBot(state: GameState, p: Player): void {
  // Commander and commander card: at random.
  if (!p.commander) {
    const ids = Object.keys(COMMANDERS);
    applyAction(state, p.id, { type: 'pickCommander', commander: ids[nextInt(state, ids.length)] });
  }
  if (p.cardOffer?.length) applyAction(state, p.id, { type: 'pickCard', card: p.cardOffer[nextInt(state, p.cardOffer.length)] });
  while (p.itemOffer?.length) applyAction(state, p.id, { type: 'pickItem', item: p.itemOffer[nextInt(state, p.itemOffer.length)] });
  placeMarks(state, p);
  playTrove(state, p);
  playAltars(state, p);
  playTwilight(state, p);
  playBlood(state, p);

  for (let i = 0; i < p.shop.length; i++) {
    const id = p.shop[i];
    if (id && (isItemCard(id) || UNIT_BY_ID[id].tier <= p.gold)) applyAction(state, p.id, { type: 'buy', slot: i });
  }

  for (let i = 0; i < p.bench.length && boardCount(p) < p.level; i++) {
    if (!p.bench[i]) continue;
    const to = p.board.indexOf(null);
    applyAction(state, p.id, { type: 'move', from: { area: 'bench', index: i }, to: { area: 'board', index: to } });
  }

  useOrb(state, p);
  playEssence(state, p);

  for (const [from, to] of tileSeating(p.board, p.orb)) {
    applyAction(state, p.id, { type: 'move', from: { area: 'board', index: from }, to: { area: 'board', index: to } });
  }

  // Hand loose items to fielded units that may hold them, in board order.
  for (const item of p.items.filter((it) => it.holder === null)) {
    const unit = p.board.find((u) => u && !equipBlock(p, item, u));
    if (unit) applyAction(state, p.id, { type: 'equip', item: item.uid, unit: unit.uid });
  }

  // Smallest bank that still earns max interest.
  const keep = interestBank();
  for (let cost = levelUpCost(p); cost !== null && p.gold - cost >= keep; cost = levelUpCost(p)) {
    applyAction(state, p.id, { type: 'levelUp' });
  }
}

// Commander marks on the most valuable fielded heroes (highest star, then cost): the umbrella on the best
// melee one (the tank), the dance on the best ranged one (the carry); either falls back to the best overall.
export function placeMarks(state: GameState, p: Player): void {
  const fielded = p.board
    .filter((u) => u !== null && !UNIT_BY_ID[u.defId].piece)
    .sort((a, b) => b!.star - a!.star || UNIT_BY_ID[b!.defId].tier - UNIT_BY_ID[a!.defId].tier);
  if (!fielded.length) return;
  const melee = (u: { defId: string }) => UNIT_BY_ID[u.defId].range <= 1;
  for (const kind of markKinds(p)) {
    if (kind === 'halo' || kind === 'halo2') {
      // Halos: the best heroes not already protected (by the other halo or the automatic one).
      if (markedUid(p, kind) !== null) continue;
      const taken = protectedUids(p);
      const best = fielded.find((u) => !taken.has(u!.uid));
      if (best) applyAction(state, p.id, { type: 'mark', kind, unit: best.uid });
      continue;
    }
    const best = fielded.find((u) => melee(u!) === (kind === 'ward')) ?? fielded[0]!;
    if (markedUid(p, kind) !== best.uid) applyAction(state, p.id, { type: 'mark', kind, unit: best.uid });
  }
}

export function interestBank(): number {
  let gold = 0;
  while (interest(gold) < MAX_INTEREST) gold += 10;
  return gold;
}

// Spend an unused orb on whichever fielded unit and trait gains the most: a new breakpoint first,
// then the bigger trait.
export function useOrb(state: GameState, p: Player): void {
  if (p.orbs.length === 0) return;
  const counts = traitCounts(p.board);
  let best: { unit: number; trait: string; score: number } | null = null;
  for (const u of p.board) {
    if (!u) continue;
    for (const trait of orbOptions(p.orbs[0], u.defId)) {
      const n = (counts[trait] ?? 0) + 1;
      const score = (traitLevel(trait, n) - traitLevel(trait, n - 1)) * 100 + n;
      if (!best || score > best.score) best = { unit: u.uid, trait, score };
    }
  }
  if (best) applyAction(state, p.id, { type: 'useOrb', unit: best.unit, trait: best.trait });
}

// Kaela's Trove: cash in at 6+ points, else roll while it's safe-ish (from 5 up a roll may go bust).
// Mirror Devices copy the highest-star fielded unit that can still be copied.
export function playTrove(state: GameState, p: Player): void {
  if (p.trove && p.trove.points >= 6) applyAction(state, p.id, { type: 'openTrove' });
  if (!p.trove || p.trove.points < 5) applyAction(state, p.id, { type: 'rollDice' });
  while (p.mirrors) {
    const unit = p.board.filter((u) => u !== null && UNIT_BY_ID[u.defId].shop !== false && state.pool[u.defId] > 0).sort((a, b) => b!.star - a!.star)[0];
    if (!unit || !applyAction(state, p.id, { type: 'useMirror', unit: unit.uid }).ok) break;
  }
}

// Alice's Blood Pacts: on the best heroes not yet blessed (highest star, then cost; board first).
export function playBlood(state: GameState, p: Player): void {
  while (p.blood?.uses) {
    const unit = [...p.board, ...p.bench]
      .filter((u) => u !== null && !bloodBlock(p, u.uid))
      .sort((a, b) => b!.star - a!.star || UNIT_BY_ID[b!.defId].tier - UNIT_BY_ID[a!.defId].tier)[0];
    if (!unit || !applyAction(state, p.id, { type: 'bloodPact', unit: unit.uid }).ok) break;
  }
}

// Lunox's blessing: on the best fielded hero (highest star, then cost), as soon as there's one.
export function playTwilight(state: GameState, p: Player): void {
  if (!p.twilight || p.twilight.holder !== null) return;
  const unit = [...p.board, ...p.bench]
    .filter((u) => u !== null && !blessBlock(p, u.uid))
    .sort((a, b) => b!.star - a!.star || UNIT_BY_ID[b!.defId].tier - UNIT_BY_ID[a!.defId].tier)[0];
  if (unit) applyAction(state, p.id, { type: 'bless', unit: unit.uid });
}

// Dyroth's altars: every use banked goes on the priciest bench hero it takes (never one off the board).
export function playAltars(state: GameState, p: Player): void {
  for (const key of ALTAR_KEYS) {
    for (let uses = altarStatus(p, key, state.round).uses; uses > 0; uses--) {
      const unit = p.bench
        .filter((u) => u !== null && !offerBlock(UNIT_BY_ID[u.defId]))
        .sort((a, b) => UNIT_BY_ID[b!.defId].tier - UNIT_BY_ID[a!.defId].tier)[0];
      if (!unit || !applyAction(state, p.id, { type: 'offer', altar: key, unit: unit.uid }).ok) break;
    }
  }
}

// Luo Yi's altar: the best hero sitting on the bench (highest star, then cost), swapped in whenever one beats
// the hero already there. Called after fielding, so it never takes a hero off the board.
export function playEssence(state: GameState, p: Player): void {
  if (!powersOf(p).essence) return;
  const rank = (u: { defId: string; star: number }) => u.star * 10 + UNIT_BY_ID[u.defId].tier;
  const best = p.bench.filter((u) => u !== null && !UNIT_BY_ID[u.defId].piece).sort((a, b) => rank(b!) - rank(a!))[0];
  if (best && (!p.essence?.hero || rank(best) > rank(p.essence.hero))) applyAction(state, p.id, { type: 'essenceIn', unit: best.uid });
}
