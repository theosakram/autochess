import { EQUIPMENT } from './items';
import { describe, expect, test } from 'bun:test';
import { applyAction, trimBoard } from './actions';
import { defenseMult, simulateCombat } from './combat';
import { GRAVE_WHISPER } from './skills';
import { createGame, resolveCombat, startRound } from './game';
import { claimRewards, syncPlayer } from './sync';
import { fieldStats } from './inventory';
import { boardCount } from './player';
import { NECROMANCER, playerTraits, traitCounts, unitStats } from './traits';
import type { GameState, Player, Star } from './types';
import { UNIT_BY_ID, UNITS } from './units';

function newGame(): GameState {
  const state = createGame(4, [
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

let uid = 90_000;
function field(p: Player, units: [defId: string, star: Star, cell: number][]): number[] {
  p.board.fill(null);
  return units.map(([defId, star, cell]) => {
    p.board[cell] = { uid: ++uid, defId, star };
    return uid;
  });
}

const wanderers = (p: Player) => [...p.board, ...p.bench].filter((u) => u && NECROMANCER.wanderers.includes(u.defId));

describe('Necromancer', () => {
  test('six units at 1, 2, 2, 3, 4, 5 gold crossing Mage, Phasewarper, Hunter, Defender, Scavenger and Weapon Master', () => {
    const units = UNITS.filter((u) => u.shop !== false && u.traits.includes('necromancer')).sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
    expect(units.map((u) => u.tier)).toEqual([1, 2, 2, 3, 4, 5]);
    expect(units.map((u) => u.traits.filter((t) => t !== 'necromancer'))).toEqual([['mage'], ['phasewarper'], ['hunter'], ['defender'], ['scavenger'], ['weaponmaster']]);
  });

  test('the grave appears (at 0) once two Necromancers are on the board, and stays', () => {
    const state = newGame();
    const p = state.players[0];
    p.bench[0] = { uid: ++uid, defId: 'val', star: 1 };
    p.bench[1] = { uid: ++uid, defId: 'natalie', star: 1 };
    p.level = 5;
    expect(applyAction(state, p.id, { type: 'move', from: { area: 'bench', index: 0 }, to: { area: 'board', index: 0 } }).ok).toBe(true);
    expect(p.stacks.necromancer).toBeUndefined();
    applyAction(state, p.id, { type: 'move', from: { area: 'bench', index: 1 }, to: { area: 'board', index: 1 } });
    expect(p.stacks.necromancer).toBe(0);
    applyAction(state, p.id, { type: 'move', from: { area: 'board', index: 1 }, to: { area: 'bench', index: 1 } });
    expect(p.stacks.necromancer).toBe(0);
  });

  test('souls: per fight by level, and per deployed unit at round start; only while active; capped', () => {
    const state = newGame();
    const [a, b] = state.players;
    field(a, [['val', 1, 15], ['natalie', 1, 16], ['footman', 1, 3]]);
    field(b, [['footman', 1, 3]]);
    resolveCombat(state);
    expect(a.stacks.necromancer).toBe(NECROMANCER.perFight[0]);
    startRound(state);
    expect(a.stacks.necromancer).toBe(NECROMANCER.perFight[0] + 3 * NECROMANCER.perDeployed[0]);
    // Level 2 (4 Necromancers) with 5 deployed.
    field(a, [['val', 1, 15], ['natalie', 1, 16], ['harley', 1, 3], ['tig', 1, 4], ['footman', 1, 5]]);
    const before = a.stacks.necromancer;
    startRound(state);
    expect(a.stacks.necromancer).toBe(before + 5 * NECROMANCER.perDeployed[1]);
    // Inactive: no gain.
    field(a, [['val', 1, 15], ['footman', 1, 3]]);
    const frozen = a.stacks.necromancer;
    startRound(state);
    expect(a.stacks.necromancer).toBe(frozen);
    // Capped.
    field(a, [['val', 1, 15], ['natalie', 1, 16]]);
    a.stacks.necromancer = NECROMANCER.maxSouls - 1;
    startRound(state);
    expect(a.stacks.necromancer).toBe(NECROMANCER.maxSouls);
  });

  test('Necromancers gain max HP per soul; others do not', () => {
    const field = (stacks: number) => ({ levels: { necromancer: 1 }, stacks: { necromancer: stacks } });
    const base = unitStats(UNIT_BY_ID.val, 1).hp;
    expect(unitStats(UNIT_BY_ID.val, 1, field(500)).hp).toBe(Math.round(base * (1 + 500 * NECROMANCER.hp)));
    expect(unitStats(UNIT_BY_ID.footman, 1, field(500)).hp).toBe(unitStats(UNIT_BY_ID.footman, 1).hp);
  });

  test('Necromancers deal more skill damage per soul; others do not', () => {
    const field = (stacks: number) => ({ levels: { necromancer: 1 }, stacks: { necromancer: stacks } });
    expect(unitStats(UNIT_BY_ID.val, 1, field(400)).skillAmp).toBeCloseTo(400 * NECROMANCER.skillAmp);
    expect(unitStats(UNIT_BY_ID.footman, 1, field(400)).skillAmp).toBe(0);
    const state = newGame();
    const [a, b] = state.players;
    a.stacks.necromancer = 600;
    field2(a);
    fieldFoe(b);
    const r = simulateCombat({ rng: 1 }, a, b);
    const adept = r.fighters.find((f) => f.defId === 'val')!.id;
    // Its skill (Grave Whisper) hits the Titan for its share of magic attack, boosted by the souls.
    const hit = r.events.find((e) => e.type === 'effect' && e.effect === 'gravewhisper' && e.by === adept);
    const raw = UNIT_BY_ID.val.ap * GRAVE_WHISPER.ap[0] * (1 + 600 * NECROMANCER.skillAmp);
    expect(hit?.type === 'effect' && hit.damage).toBe(Math.round(raw * defenseMult(UNIT_BY_ID.titan.mr)));
  });

  test('100 / 350 / 999 souls: a Plane Wanderer, then raised to 2 and 3 stars', () => {
    const state = newGame();
    const p = state.players[0];
    p.stacks.necromancer = 99;
    syncPlayer(state, p);
    expect(wanderers(p)).toHaveLength(0);
    p.stacks.necromancer = 100;
    syncPlayer(state, p);
    expect(wanderers(p).map((u) => u!.star)).toEqual([1]);
    p.stacks.necromancer = 360;
    syncPlayer(state, p);
    expect(wanderers(p).map((u) => u!.star)).toEqual([2]);
    p.stacks.necromancer = 999;
    syncPlayer(state, p);
    syncPlayer(state, p);
    expect(wanderers(p).map((u) => u!.star)).toEqual([3]);
    expect(p.rewards?.necromancer).toBe(NECROMANCER.rewards.length);
  });

  test('200 / 400 / 600 souls: gold, a random equipment, a Magic Orb', () => {
    const state = newGame();
    const p = state.players[0];
    p.items = [];
    p.orbs = [];
    p.stacks.necromancer = 199;
    syncPlayer(state, p);
    const gold = p.gold;
    p.stacks.necromancer = 200;
    syncPlayer(state, p);
    expect(p.gold).toBe(gold + 10);
    expect(p.items).toHaveLength(0);
    p.stacks.necromancer = 400;
    syncPlayer(state, p);
    expect(p.items).toHaveLength(1);
    expect(EQUIPMENT).toContain(p.items[0].id);
    expect(p.orbs).toHaveLength(0);
    p.stacks.necromancer = 600;
    syncPlayer(state, p);
    expect(p.orbs).toHaveLength(1);
    // Claimed once: nothing more on the next sync.
    syncPlayer(state, p);
    expect([p.gold, p.items.length, p.orbs.length]).toEqual([gold + 10, 1, 1]);
  });

  test('a reward waits for bench room; one sold before an upgrade comes back at the new star', () => {
    const state = newGame();
    const p = state.players[0];
    p.bench.fill(null).forEach((_, i) => (p.bench[i] = { uid: ++uid, defId: 'footman', star: 1 }));
    p.stacks.necromancer = 120;
    claimRewards(state, p);
    expect(wanderers(p)).toHaveLength(0);
    p.bench[3] = null;
    claimRewards(state, p);
    expect(wanderers(p)).toHaveLength(1);
    const at = p.bench.findIndex((u) => u && NECROMANCER.wanderers.includes(u.defId));
    const pool = { ...state.pool };
    expect(applyAction(state, p.id, { type: 'sell', from: { area: 'bench', index: at } }).ok).toBe(true);
    expect(state.pool).toEqual(pool);
    p.stacks.necromancer = 350;
    claimRewards(state, p);
    expect(wanderers(p).map((u) => u!.star)).toEqual([2]);
  });

  test('Plane Wanderers are never in the pool or the shop', () => {
    const state = newGame();
    for (const w of NECROMANCER.wanderers) expect(w in state.pool).toBe(false);
    for (let i = 0; i < 30; i++) {
      startRound(state);
      for (const p of state.players) for (const w of NECROMANCER.wanderers) expect(p.shop).not.toContain(w);
    }
  });
});

function field2(p: Player) {
  field(p, [['tig', 2, 3], ['val', 1, 17], ['natalie', 1, 16]]);
}
function fieldFoe(p: Player) {
  field(p, [['titan', 1, 3]]);
}

describe('Plane Wanderer', () => {
  test('five 5-gold variants, one per role: Fighter, Deadeye, Hunter, Dauntless, Stargazer', () => {
    expect(NECROMANCER.wanderers.map((id) => [UNIT_BY_ID[id].tier, ...UNIT_BY_ID[id].traits])).toEqual([
      [5, 'fighter'],
      [5, 'deadeye'],
      [5, 'hunter'],
      [5, 'dauntless'],
      [5, 'stargazer'],
    ]);
  });

  test('rolled once when the grave first appears, and kept even after the Necromancers leave and come back', () => {
    const picks = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const state = createGame(seed, [{ id: 'a', name: 'A', isBot: false }]);
      const p = state.players[0];
      p.board.fill(null);
      p.bench.fill(null);
      p.stacks = {};
      p.rewardUnit = undefined;
      p.board[0] = { uid: ++uid, defId: 'val', star: 1 };
      p.board[1] = { uid: ++uid, defId: 'natalie', star: 1 };
      syncPlayer(state, p);
      const pick = p.rewardUnit!.necromancer;
      expect(NECROMANCER.wanderers).toContain(pick);
      p.board.fill(null);
      syncPlayer(state, p);
      p.board[2] = { uid: ++uid, defId: 'harley', star: 1 };
      p.board[3] = { uid: ++uid, defId: 'tig', star: 1 };
      syncPlayer(state, p);
      expect(p.rewardUnit!.necromancer).toBe(pick);
      p.stacks.necromancer = 100;
      syncPlayer(state, p);
      expect(wanderers(p).map((u) => u!.defId)).toEqual([pick]);
      picks.add(pick);
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  test('takes no board slot: a full board still fits it', () => {
    const state = newGame();
    const p = state.players[0];
    p.level = 3;
    field(p, [['val', 1, 0], ['natalie', 1, 1], ['harley', 1, 2]]);
    p.bench[0] = { uid: ++uid, defId: 'gatotkaca', star: 1 };
    p.bench[1] = { uid: ++uid, defId: 'tig', star: 1 };
    expect(applyAction(state, p.id, { type: 'move', from: { area: 'bench', index: 0 }, to: { area: 'board', index: 5 } }).ok).toBe(true);
    expect(boardCount(p)).toBe(3);
    // Past the limit now: trimming takes a slot unit off, never the Wanderer.
    expect(applyAction(state, p.id, { type: 'move', from: { area: 'bench', index: 1 }, to: { area: 'board', index: 6 } }).ok).toBe(true);
    trimBoard(state, p);
    expect(boardCount(p)).toBe(3);
    expect(p.board.some((u) => u?.defId === 'gatotkaca')).toBe(true);
  });

  test('gets the Necromancer bonus from souls without counting as a Necromancer', () => {
    const state = newGame();
    const p = state.players[0];
    field(p, [['val', 1, 0], ['natalie', 1, 1]]);
    p.board[5] = { uid: ++uid, defId: 'moscow', star: 1 };
    p.stacks.necromancer = 400;
    expect(traitCounts(p.board).necromancer).toBe(2);
    expect(traitCounts(p.board).deadeye).toBe(1);
    const stats = fieldStats(p, playerTraits(p)).get(p.board[5]!.uid)!;
    expect(stats.skillAmp).toBeCloseTo(400 * NECROMANCER.skillAmp);
  });
});

describe('Necromancer 10', () => {
  test('fills the grave to 999 at once (all Plane Wanderer stars) and pays extra gold every round', () => {
    const state = newGame();
    const p = state.players[0];
    p.level = 10;
    p.stacks.necromancer = 40;
    field(p, [['val', 1, 0], ['natalie', 1, 1], ['harley', 1, 2], ['tig', 1, 3], ['sora', 1, 4], ['thamar', 1, 5]]);
    // 6 Necromancers + 4 Mist orbs on them = 10.
    p.mistOrbs = [0, 1, 2, 3].map((i) => ({ uid: 80_000 + i, trait: 'necromancer', holder: p.board[i]!.uid }));
    expect(playerTraits(p).necromancer).toBe(4);
    syncPlayer(state, p);
    expect(p.stacks.necromancer).toBe(NECROMANCER.maxSouls);
    expect(wanderers(p).map((u) => u!.star)).toEqual([3]);
    const gold = p.gold;
    startRound(state);
    expect(p.gold - gold).toBeGreaterThanOrEqual(NECROMANCER.goldPerRound[3]);
    const without = newGame();
    const q = without.players[0];
    field(q, [['val', 1, 0], ['natalie', 1, 1]]);
    // Same bank, so interest matches (the grave's gold milestone raised p's).
    q.gold = gold;
    const before = q.gold;
    startRound(without);
    // Necromancer 2 pays nothing extra: the difference is just income.
    expect(p.gold - gold - (q.gold - before)).toBe(NECROMANCER.goldPerRound[3]);
  });
});

