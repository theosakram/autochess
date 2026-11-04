import { applyAction } from './actions';
import { MAX_LEVEL, XP_COST } from './config';
import { boardCount } from './player';
import type { GameState, Player } from './types';
import { UNIT_BY_ID } from './units';

// Placeholder AI: buy whatever is affordable, field as much as the cap allows,
// dump spare gold above 10 into XP so interest keeps ticking.
export function runBot(state: GameState, p: Player): void {
  for (let i = 0; i < p.shop.length; i++) {
    const id = p.shop[i];
    if (id && UNIT_BY_ID[id].tier <= p.gold) applyAction(state, p.id, { type: 'buy', slot: i });
  }

  for (let i = 0; i < p.bench.length && boardCount(p) < p.level; i++) {
    if (!p.bench[i]) continue;
    const to = p.board.indexOf(null);
    applyAction(state, p.id, { type: 'move', from: { area: 'bench', index: i }, to: { area: 'board', index: to } });
  }

  while (p.level < MAX_LEVEL && p.gold >= XP_COST + 10) {
    applyAction(state, p.id, { type: 'buyXp' });
  }
}
