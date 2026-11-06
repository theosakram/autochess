import { applyAction } from './actions';
import { COMMANDERS, markedUid, markKinds, protectedUids } from './commanders';
import { MAX_INTEREST } from './config';
import { nextInt } from './rng';
import { equipBlock } from './inventory';
import { isItemCard } from './items';
import { boardCount, interest, levelUpCost } from './player';
import { orbOptions } from './orb';
import { tileSeating, traitCounts, traitLevel } from './traits';
import type { GameState, Player } from './types';
import { UNIT_BY_ID } from './units';

// Placeholder AI: buy whatever is affordable, field as much as the cap allows,
// take any trait tiles, level up whenever it can still keep max interest.
export function runBot(state: GameState, p: Player): void {
  // Commander and commander card: at random.
  if (!p.commander) {
    const ids = Object.keys(COMMANDERS);
    applyAction(state, p.id, { type: 'pickCommander', commander: ids[nextInt(state, ids.length)] });
  }
  if (p.cardOffer?.length) applyAction(state, p.id, { type: 'pickCard', card: p.cardOffer[nextInt(state, p.cardOffer.length)] });
  while (p.itemOffer?.length) applyAction(state, p.id, { type: 'pickItem', item: p.itemOffer[nextInt(state, p.itemOffer.length)] });
  placeMarks(state, p);

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
function placeMarks(state: GameState, p: Player): void {
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

function interestBank(): number {
  let gold = 0;
  while (interest(gold) < MAX_INTEREST) gold += 10;
  return gold;
}

// Spend an unused orb on whichever fielded unit and trait gains the most: a new breakpoint first,
// then the bigger trait.
function useOrb(state: GameState, p: Player): void {
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
