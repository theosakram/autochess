import { describe, expect, test } from 'bun:test';
import { simulateCombat } from './combat';
import { createGame } from './game';
import { fieldLeaders, fieldStats } from './inventory';
import { ASTRAL, activeTraits, traitLevel } from './traits';
import type { GameState, Player, Star } from './types';
import { UNIT_BY_ID } from './units';
import { unitStats } from './traits';
import { unitDetailHtml } from '../ui/views';

const ASTRALS = ['minos', 'martin', 'katarina', 'hilman', 'irina', 'odette'];

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
    expect(UNIT_BY_ID.irina.traits).toEqual(['astral', 'deadeye']);
    expect(UNIT_BY_ID.odette.traits).toEqual(['astral', 'mage']);
    expect([2, 4, 6, 10].map((n) => traitLevel('astral', n))).toEqual([1, 2, 3, 4]);
  });

  test('the Astral carrying the most items is the Sovereign, inactive items included', () => {
    const state = newGame();
    const p = state.players[0];
    const [squire, lancer] = field(p, [['minos', 1, 0], ['martin', 1, 1], ['footman', 1, 2]]);
    give(p, squire, 2); // Keris works only with Gustiwana, but it's still carried
    give(p, lancer, 1);
    expect(fieldLeaders(p, activeTraits(p.board))).toEqual({ astral: [squire] });
  });

  test('ties go to higher star, then higher tier, then board order; non-Astrals never lead', () => {
    const state = newGame();
    const p = state.players[0];
    let [a, b] = field(p, [['minos', 2, 0], ['martin', 1, 1]]);
    expect(fieldLeaders(p, activeTraits(p.board)).astral).toEqual([a]);
    [a, b] = field(p, [['minos', 1, 0], ['martin', 1, 1]]);
    expect(fieldLeaders(p, activeTraits(p.board)).astral).toEqual([b]);
    const [footman] = field(p, [['footman', 1, 0], ['minos', 1, 1], ['martin', 1, 2]]);
    give(p, footman, 3);
    expect(fieldLeaders(p, activeTraits(p.board)).astral).not.toContain(footman);
    // Inactive trait: no leader.
    field(p, [['minos', 1, 0]]);
    expect(fieldLeaders(p, activeTraits(p.board))).toEqual({});
  });

  test('at the 10 breakpoint the top two Astrals are both Sovereigns', () => {
    const state = newGame();
    const p = state.players[0];
    const [squire, lancer, seer] = field(p, [['minos', 1, 0], ['martin', 1, 1], ['katarina', 1, 2]]);
    give(p, squire, 1);
    give(p, seer, 2);
    expect(fieldLeaders(p, { astral: 3 }).astral).toEqual([seer]);
    expect(fieldLeaders(p, { astral: 4 }).astral).toEqual([seer, squire]);
    expect(fieldLeaders(p, { astral: 4 }).astral).not.toContain(lancer);
  });

  test('Astrals deal more damage, the Sovereign more on top plus hybrid lifesteal; others get nothing', () => {
    const state = newGame();
    const p = state.players[0];
    const [squire, lancer, footman] = field(p, [['minos', 1, 0], ['martin', 1, 1], ['footman', 1, 2]]);
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
    const [squire] = field(a, [['minos', 1, 3], ['martin', 1, 4]]);
    give(a, squire, 1);
    field(b, [['knight', 1, 3]]);
    const r = simulateCombat({ rng: 1 }, a, b);
    expect(r.fighters.find((f) => f.defId === 'minos')!.leads).toEqual(['astral']);
    expect(r.fighters.find((f) => f.defId === 'martin')!.leads).toEqual([]);
    expect(unitDetailHtml(a, squire, {})).toContain('Astral Sovereign');
  });
});
