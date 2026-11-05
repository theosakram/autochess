import { describe, expect, test } from 'bun:test';
import { simulateCombat } from './combat';
import { createGame } from './game';
import { fieldLeaders, fieldStats } from './inventory';
import { ASTRAL, activeTraits, traitLevel } from './traits';
import type { GameState, Player, Star } from './types';
import { UNIT_BY_ID } from './units';
import { unitStats } from './traits';
import { unitDetailHtml } from '../ui/views';

const ASTRALS = ['stardustsquire', 'cometlancer', 'nebulaseer', 'zodiacblade', 'polaris', 'empyrean'];

function newGame(): GameState {
  const state = createGame(5, [
    { id: 'a', name: 'A', isBot: false },
    { id: 'b', name: 'B', isBot: false },
  ]);
  for (const p of state.players) {
    p.bench.fill(null);
    p.board.fill(null);
    p.items = [];
  }
  return state;
}

let uid = 70_000;
function field(p: Player, units: [defId: string, star: Star, cell: number][]): number[] {
  p.board.fill(null);
  return units.map(([defId, star, cell]) => {
    p.board[cell] = { uid: ++uid, defId, star };
    return uid;
  });
}

const give = (p: Player, holder: number, n: number) => {
  for (let i = 0; i < n; i++) p.items.push({ uid: ++uid, id: 'keris', tier: 1, holder });
};

describe('Astral', () => {
  test('six units at tiers 1, 2, 3, 3, 4, 5; the 4g is Deadeye, the 5g Mage', () => {
    expect(ASTRALS.map((id) => UNIT_BY_ID[id].tier)).toEqual([1, 2, 3, 3, 4, 5]);
    expect(UNIT_BY_ID.polaris.traits).toEqual(['astral', 'deadeye']);
    expect(UNIT_BY_ID.empyrean.traits).toEqual(['astral', 'mage']);
    expect([2, 4, 6, 10].map((n) => traitLevel('astral', n))).toEqual([1, 2, 3, 4]);
  });

  test('the Astral carrying the most items is the Sovereign, inactive items included', () => {
    const state = newGame();
    const p = state.players[0];
    const [squire, lancer] = field(p, [['stardustsquire', 1, 0], ['cometlancer', 1, 1], ['footman', 1, 2]]);
    give(p, squire, 2); // Keris works only with Gustiwana, but it's still carried
    give(p, lancer, 1);
    expect(fieldLeaders(p, activeTraits(p.board))).toEqual({ astral: squire });
  });

  test('ties go to higher star, then higher tier, then board order; non-Astrals never lead', () => {
    const state = newGame();
    const p = state.players[0];
    let [a, b] = field(p, [['stardustsquire', 2, 0], ['cometlancer', 1, 1]]);
    expect(fieldLeaders(p, activeTraits(p.board)).astral).toBe(a);
    [a, b] = field(p, [['stardustsquire', 1, 0], ['cometlancer', 1, 1]]);
    expect(fieldLeaders(p, activeTraits(p.board)).astral).toBe(b);
    const [footman] = field(p, [['footman', 1, 0], ['stardustsquire', 1, 1], ['cometlancer', 1, 2]]);
    give(p, footman, 3);
    expect(fieldLeaders(p, activeTraits(p.board)).astral).not.toBe(footman);
    // Inactive trait: no leader.
    field(p, [['stardustsquire', 1, 0]]);
    expect(fieldLeaders(p, activeTraits(p.board))).toEqual({});
  });

  test('Astrals deal more damage, the Sovereign more on top plus hybrid lifesteal; others get nothing', () => {
    const state = newGame();
    const p = state.players[0];
    const [squire, lancer, footman] = field(p, [['stardustsquire', 1, 0], ['cometlancer', 1, 1], ['footman', 1, 2]]);
    give(p, squire, 1);
    const s = fieldStats(p, activeTraits(p.board));
    expect(s.get(squire)!.damageAmp).toBeCloseTo(ASTRAL.damageAmp[0] + ASTRAL.sovereignAmp[0]);
    expect(s.get(squire)!.lifesteal).toBeCloseTo(ASTRAL.sovereignLifesteal[0]);
    expect(s.get(squire)!.spellLifesteal).toBeCloseTo(ASTRAL.sovereignLifesteal[0]);
    expect(s.get(lancer)!.damageAmp).toBeCloseTo(ASTRAL.damageAmp[0]);
    expect(s.get(lancer)!.lifesteal).toBe(0);
    expect(s.get(footman)).toEqual(unitStats(UNIT_BY_ID.footman, 1));
  });

  test('combat and the unit card both mark the Sovereign', () => {
    const state = newGame();
    const [a, b] = state.players;
    const [squire] = field(a, [['stardustsquire', 1, 3], ['cometlancer', 1, 4]]);
    give(a, squire, 1);
    field(b, [['knight', 1, 3]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    expect(r.fighters.find((f) => f.defId === 'stardustsquire')!.leads).toEqual(['astral']);
    expect(r.fighters.find((f) => f.defId === 'cometlancer')!.leads).toEqual([]);
    expect(unitDetailHtml(a, squire, {})).toContain('Astral Sovereign');
  });
});
