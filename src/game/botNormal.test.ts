import { describe, expect, test } from 'bun:test';
import { createGame, isGameOver, resolveCombat, startRound } from './game';
import { boardCount, heroCapOf } from './player';
import { UNIT_BY_ID } from './units';

describe('normal bot', () => {
  test('plays a whole game: board within its level, items on fielded heroes, someone wins', () => {
    const st = createGame(8, Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, name: '', isBot: true, botLevel: i < 4 ? ('normal' as const) : ('easy' as const) })));
    let stars = 0;
    while (!isGameOver(st) && st.round < 60) {
      resolveCombat(st);
      if (isGameOver(st)) break;
      startRound(st);
      for (const p of st.players.filter((x) => x.hp > 0 && x.botLevel === 'normal')) {
        expect(boardCount(p)).toBeLessThanOrEqual(heroCapOf(p));
        const onBoard = new Set(p.board.flatMap((u) => (u ? [u.uid] : [])));
        expect(p.items.every((it) => it.holder === null || onBoard.has(it.holder))).toBe(true);
        stars = Math.max(stars, ...p.board.map((u) => (u && !UNIT_BY_ID[u.defId].piece ? u.star : 0)));
      }
    }
    expect(isGameOver(st)).toBe(true);
    expect(stars).toBeGreaterThanOrEqual(2);
  });
});
