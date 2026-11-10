import { copiesOf } from './merge';
import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { createGame } from './game';
import { fieldStats } from './inventory';
import { MIST_WARES, openMistShop } from './mistShop';
import { syncPlayer } from './sync';
import { playerTraitCounts, playerTraits, TRAITS, unitStats } from './traits';
import type { GameState, Player } from './types';
import { UNIT_BY_ID } from './units';

function setup(coins = 999): { state: GameState; p: Player } {
  const state = createGame(15, [{ id: 'a', name: 'A', isBot: false }]);
  const p = state.players[0];
  p.board.fill(null);
  p.bench.fill(null);
  p.items = [];
  p.level = 9;
  p.board[0] = { uid: 9001, defId: 'uranus', star: 1 };
  syncPlayer(state, p);
  p.stacks.mistbender = coins;
  return { state, p };
}
const buy = (state: GameState, p: Player, slot: number, choice?: string) => applyAction(state, p.id, { type: 'mistBuy', slot, ...(choice && { choice }) });

describe('Mist Shop', () => {
  test('opens once a Mistbender is fielded: Nana in the middle, cheap wares either side', () => {
    const { p } = setup();
    expect(p.mistShop).toHaveLength(3);
    expect(p.mistShop![1]).toBe('nana');
    for (const id of [p.mistShop![0], p.mistShop![2]]) expect(id).toMatch(/^(blade|shield)[123]$/);
    // Only once: re-syncing keeps it.
    const before = [...p.mistShop!];
    openMistShop(createGame(1, [{ id: 'x', name: 'X', isBot: false }]), p);
    expect(p.mistShop).toEqual(before);
  });

  test('prices: Blades and Shields 8/16/24, Nana 60, Mirror and random orbs 80, picked orbs 160', () => {
    expect(['blade1', 'blade2', 'blade3', 'shield1', 'shield2', 'shield3'].map((id) => MIST_WARES[id].price)).toEqual([8, 16, 24, 8, 16, 24]);
    expect(['nana', 'mirror', 'randomfactionorb', 'randomroleorb', 'pickfactionorb', 'pickroleorb'].map((id) => MIST_WARES[id].price)).toEqual([60, 80, 80, 80, 160, 160]);
  });

  test('buying pays in Mist coins and refills that slot; not enough coins: refused', () => {
    const { state, p } = setup(70);
    const before = state.pool.nana;
    expect(buy(state, p, 1).ok).toBe(true);
    expect(p.stacks.mistbender).toBe(10);
    expect(p.bench.some((u) => u?.defId === 'nana')).toBe(true);
    expect(state.pool.nana).toBe(before - 1);
    expect(p.mistShop![1]).not.toBe('nana'); // Nana is a first-batch ware only
    p.mistShop![0] = 'blade3';
    expect(buy(state, p, 0)).toEqual({ ok: false, error: 'Needs 24 Mist coins' });
    expect(p.stacks.mistbender).toBe(10);
  });

  test('Blades (both attacks) and Shields (both defenses) stack, and every fielded unit gets them', () => {
    const { state, p } = setup();
    p.board[1] = { uid: 9002, defId: 'knight', star: 1 };
    p.mistShop = ['blade3', 'blade1', 'shield2'];
    buy(state, p, 0);
    p.mistShop[0] = 'blade3';
    buy(state, p, 0);
    buy(state, p, 1);
    buy(state, p, 2);
    expect(p.mistBonus!.atk).toBeCloseTo(0.07);
    expect(p.mistBonus!.def).toBeCloseTo(0.02);
    const s = fieldStats(p, playerTraits(p)).get(9002)!;
    const plain = unitStats(UNIT_BY_ID.knight, 1);
    expect(s.atk).toBe(Math.round(plain.atk * 1.07));
    expect(s.ap).toBe(Math.round(plain.ap * 1.07));
    expect(s.armor).toBeCloseTo(plain.armor * 1.02);
    expect(s.mr).toBeCloseTo(plain.mr * 1.02);
  });

  test('Mirror goes to the inventory, to copy one of your units from the pool whenever you like', () => {
    const { state, p } = setup();
    p.mistShop = ['mirror', 'blade1', 'blade1'];
    const pool = state.pool.uranus;
    expect(buy(state, p, 0).ok).toBe(true); // no pick: it's an item
    expect(p.mirrors).toBe(1);
    expect([...p.board, ...p.bench].filter((u) => u?.defId === 'uranus')).toHaveLength(1);
    // Later: use it.
    expect(applyAction(state, p.id, { type: 'useMirror', unit: 9001 }).ok).toBe(true);
    expect(p.mirrors).toBe(0);
    expect([...p.board, ...p.bench].filter((u) => u?.defId === 'uranus')).toHaveLength(2);
    expect(state.pool.uranus).toBe(pool - 1);
    expect(applyAction(state, p.id, { type: 'useMirror', unit: 9001 }).ok).toBe(false); // none left
    // The pool ran dry: it still copies, from outside the pool (a shortfall, never handed back).
    state.pool.uranus = 0;
    p.mirrors = 1;
    expect(applyAction(state, p.id, { type: 'useMirror', unit: 9001 }).ok).toBe(true);
    const copies = [...p.board, ...p.bench].reduce((n, u) => n + (u?.defId === 'uranus' ? copiesOf(u) : 0), 0);
    expect(copies).toBe(3); // the third merges them into a 2★
    expect(state.pool.uranus).toBe(0);
  });

  test('orbs are held like items: +1 while the holder is fielded, movable, back to inventory when it leaves', async () => {
    const { state, p } = setup();
    p.board[1] = { uid: 9002, defId: 'aldo', star: 1 };
    p.board[2] = { uid: 9003, defId: 'phove', star: 1 };
    p.mistShop = ['pickfactionorb', 'pickfactionorb', 'randomroleorb'];
    expect(buy(state, p, 0, 'fighter').ok).toBe(false); // a role isn't a faction
    expect(buy(state, p, 0, 'mistbender').ok).toBe(false); // never reaches 6: not on offer
    expect(buy(state, p, 0, 'spectre').ok).toBe(true);
    expect(p.mistOrbs![0].trait).toBe('spectre');
    // A Mistbender orb (from before the rule) still works like any other.
    p.mistOrbs = [{ uid: state.nextUid++, trait: 'mistbender', holder: null }];
    const orb = p.mistOrbs![0];
    expect(orb).toMatchObject({ trait: 'mistbender', holder: null });
    expect(playerTraitCounts(p).mistbender).toBe(2); // in the inventory: nothing yet
    const equip = (unit: number, o = orb.uid) => applyAction(state, p.id, { type: 'equipMistOrb', orb: o, unit });
    expect(equip(9003).ok).toBe(true); // on Phove
    expect(playerTraitCounts(p).mistbender).toBe(3);
    expect(playerTraits(p).mistbender).toBe(2); // Mistbender 3
    // Move it to Aldo, like an item.
    expect(equip(9002).ok).toBe(true);
    expect(orb.holder).toBe(9002);
    expect(playerTraitCounts(p).mistbender).toBe(3);
    // One per unit; not on the Magic Orb's unit type.
    p.mistOrbs.push({ uid: state.nextUid++, trait: 'mistbender', holder: null });
    const second = p.mistOrbs![1];
    expect(equip(9002, second.uid)).toEqual({ ok: false, error: 'It already holds a faction or role orb' });
    p.orb = { defId: 'phove', trait: 'spectre' };
    expect(equip(9003, second.uid)).toEqual({ ok: false, error: 'It already has the Magic Orb' });
    expect(equip(9001, second.uid).ok).toBe(true);
    expect(playerTraitCounts(p).mistbender).toBe(4);
    // Selling the holder: the orb comes back, not gone.
    const aldoAt = p.board.findIndex((u) => u?.uid === 9002);
    expect(applyAction(state, p.id, { type: 'sell', from: { area: 'board', index: aldoAt } }).ok).toBe(true);
    expect(orb.holder).toBeNull();
    expect(p.mistOrbs).toHaveLength(2);
    // Off the board (benched), its holder's orb doesn't count.
    expect(applyAction(state, p.id, { type: 'unequipMistOrb', orb: second.uid }).ok).toBe(true);
    expect(second.holder).toBeNull();
    // And the Magic Orb can't go on a unit type holding a Mist orb.
    equip(9003, orb.uid); // fails: Phove has the Magic Orb now
    p.orb = null;
    expect(equip(9003, orb.uid).ok).toBe(true);
    p.orbs = [12345];
    const options = (await import('./orb')).orbOptions(12345, 'phove');
    expect(applyAction(state, p.id, { type: 'useOrb', unit: 9003, trait: options[0] })).toEqual({ ok: false, error: 'It already holds a faction or role orb' });
  });

  test('random 4- and 5-gold units, for 32 and 40', async () => {
    const { state, p } = setup();
    expect([MIST_WARES.random4.price, MIST_WARES.random5.price]).toEqual([32, 40]);
    p.mistShop = ['random4', 'random5', 'blade1'];
    expect(buy(state, p, 0).ok).toBe(true);
    expect(buy(state, p, 1).ok).toBe(true);
    const tiers = p.bench.filter(Boolean).map((u) => UNIT_BY_ID[u!.defId].tier).sort();
    expect(tiers).toEqual([4, 5]);
  });

  test('coins cap at 200', () => {
    expect(TRAITS.mistbender.stacks!.max).toBe(200);
  });
});
