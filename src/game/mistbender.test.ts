import { describe, expect, test } from 'bun:test';
import { memberSkills } from './combat';
import { createGame, resolveCombat } from './game';
import { MISTBENDER } from './traits';
import type { GameState, Player, Star } from './types';
import { UNITS } from './units';
import { sideShopsHtml } from '../ui/views';

function newGame(): GameState {
  const state = createGame(6, [
    { id: 'a', name: 'A', isBot: false },
    { id: 'b', name: 'B', isBot: false },
  ]);
  for (const p of state.players) {
    p.board.fill(null);
    p.bench.fill(null);
    p.items = [];
    p.stacks = {};
  }
  return state;
}

let uid = 95_000;
function field(p: Player, units: [defId: string, star: Star, cell: number][]): void {
  p.board.fill(null);
  for (const [defId, star, cell] of units) p.board[cell] = { uid: ++uid, defId, star };
}

describe('Mistbender', () => {
  test('three units at 1, 3, 5 gold crossing Dauntless, Fighter and Stargazer', () => {
    const units = UNITS.filter((u) => u.shop !== false && u.traits.includes('mistbender')).sort((a, b) => a.tier - b.tier);
    expect(units.map((u) => u.tier)).toEqual([1, 3, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'mistbender'))).toEqual([['dauntless'], ['fighter'], ['stargazer']]);
  });

  test('the Mist Shop shows while any Mistbender is fielded, even one', () => {
    const state = newGame();
    const p = state.players[0];
    expect(sideShopsHtml(p)).toBe('');
    field(p, [['hazeguard', 1, 3]]);
    expect(sideShopsHtml(p)).toContain('Mist Shop');
    p.bench[0] = p.board[3];
    p.board[3] = null;
    expect(sideShopsHtml(p)).toBe('');
  });

  test('coins per Mistbender skill: 1 at 2 Mistbenders, 2 at 3; nothing with only one', () => {
    for (const [units, perSkill] of [
      [['hazeguard', 'fogfist'], MISTBENDER.coinsPerSkill[0]],
      [['hazeguard', 'fogfist', 'mistoracle'], MISTBENDER.coinsPerSkill[1]],
      [['hazeguard'], 0],
    ] as const) {
      const state = newGame();
      const [a, b] = state.players;
      field(a, units.map((d, i) => [d, 2, [3, 4, 17][i]] as [string, Star, number]));
      field(b, [['titan', 3, 3], ['paladin', 3, 4]]);
      const [fight] = resolveCombat(state);
      const side = fight.home === a.id ? 0 : 1;
      const skills = memberSkills(fight.result, side, 'mistbender');
      if (perSkill) expect(skills).toBeGreaterThan(0);
      expect(a.stacks.mistbender ?? 0).toBe(skills * perSkill);
    }
  });
});
