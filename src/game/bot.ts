import { applyAction } from './actions';
import { MAX_INTEREST } from './config';
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
