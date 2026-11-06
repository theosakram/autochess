import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { ANGELA, autoHalo, BEAST_PIECE, beastOf, cardFace, KAGURA, LUKAS, markedUid, markKinds, powersOf, protectedUids } from './commanders';
import { ITEMS } from './items';
import { fieldStats } from './inventory';
import { syncPlayer } from './sync';
import { playerTraits, unitStats } from './traits';
import { simulateCombat, defenseMult } from './combat';
import { BOARD_COLS, COMMANDER_CARD_ROUND } from './config';
import { createGame, resolveCombat, startRound } from './game';
import { boardCount } from './player';
import type { GameState, Player } from './types';
import { UNIT_BY_ID } from './units';

const SEEDS = [
  { id: 'you', name: 'You', isBot: false },
  { id: 'b', name: 'B', isBot: false },
];

function game(): GameState {
  const state = createGame(5, SEEDS);
  for (const p of state.players) expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'lukas' }).ok).toBe(true);
  return state;
}
const beastCell = (p: Player) => p.board.findIndex((u) => u?.defId === BEAST_PIECE);
const row = (cell: number) => Math.floor(cell / BOARD_COLS);

describe('commanders', () => {
  test('a commander is picked once; Lukas puts his beast on the back row, taking no slot', () => {
    const state = createGame(5, SEEDS);
    const p = state.players[0];
    expect(p.commander).toBeNull();
    expect(beastCell(p)).toBe(-1);
    const before = boardCount(p);
    expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'lukas' }).ok).toBe(true);
    expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'lukas' }).ok).toBe(false);
    expect(row(beastCell(p))).toBe(2);
    expect(boardCount(p)).toBe(before);
  });

  test("the beast can't be sold, benched, or (innate) put on the front row", () => {
    const state = game();
    const p = state.players[0];
    const from = { area: 'board' as const, index: beastCell(p) };
    expect(applyAction(state, p.id, { type: 'sell', from }).ok).toBe(false);
    expect(applyAction(state, p.id, { type: 'move', from, to: { area: 'bench', index: 7 } }).ok).toBe(false);
    expect(applyAction(state, p.id, { type: 'move', from, to: { area: 'board', index: 3 } }).ok).toBe(false);
    expect(applyAction(state, p.id, { type: 'move', from, to: { area: 'board', index: BOARD_COLS + 3 } }).ok).toBe(true);
    // Swapping a unit into its cell can't push it onto the bench either.
    p.bench[0] = { uid: 999, defId: 'kindler', star: 1 };
    expect(applyAction(state, p.id, { type: 'move', from: { area: 'bench', index: 0 }, to: { area: 'board', index: beastCell(p) } }).ok).toBe(false);
  });

  test('round 2 offers the own card first; Vanguard Beast on Lukas upgrades the beast and frees the front row', () => {
    const state = game();
    const p = state.players[0];
    while (state.round < COMMANDER_CARD_ROUND) {
      resolveCombat(state);
      startRound(state);
    }
    expect(p.cardOffer?.[0]).toBe('lukas');
    expect(applyAction(state, p.id, { type: 'pickCard', card: 'nobody' }).ok).toBe(false);
    expect(applyAction(state, p.id, { type: 'pickCard', card: 'lukas' }).ok).toBe(true);
    expect(p.cardOffer).toBeUndefined();
    expect(beastOf(p)).toEqual(LUKAS.card);
    const from = { area: 'board' as const, index: beastCell(p) };
    expect(applyAction(state, p.id, { type: 'move', from, to: { area: 'board', index: 3 } }).ok).toBe(true);
  });

  test('an unpicked card defaults to the own one when the fight starts', () => {
    const state = game();
    while (state.round < COMMANDER_CARD_ROUND) {
      resolveCombat(state);
      startRound(state);
    }
    resolveCombat(state);
    expect(state.players[0].commanderCard).toBe('lukas');
  });

  test("on another commander, Lukas's card grants the plain beast, not the upgrade", () => {
    const state = game();
    const p = state.players[0];
    p.commander = 'someoneelse';
    expect(cardFace(p, 'lukas')).toMatchObject({ self: false, power: { beast: LUKAS.innate } });
  });
});

describe('the Divine Beast in combat', () => {
  function fight(front: boolean) {
    const state = game();
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
    }
    if (front) a.commanderCard = 'lukas';
    a.board[front ? 3 : 2 * BOARD_COLS + 3] = { uid: 1, defId: BEAST_PIECE, star: 1 };
    a.board[2 * BOARD_COLS] = { uid: 2, defId: 'knight', star: 1 };
    // Three enemies side by side in their front row, one far off.
    for (const [i, cell] of [2, 3, 4].entries()) b.board[cell] = { uid: 10 + i, defId: 'knight', star: 1 };
    b.board[2 * BOARD_COLS + 6] = { uid: 20, defId: 'knight', star: 1 };
    return simulateCombat({ rng: 1 }, a, b);
  }

  test('from the back: beams the densest 3x3, 30% max hp as magic, and stuns; it never fights', () => {
    const r = fight(false);
    expect(r.fighters.some((f) => f.defId === BEAST_PIECE)).toBe(false);
    const hits = r.events.filter((e) => e.type === 'effect' && e.effect === BEAST_PIECE);
    expect(hits).toHaveLength(3);
    const knight = r.fighters.find((f) => f.side === 1)!;
    for (const e of hits) if (e.type === 'effect') expect(e.damage).toBe(Math.round(knight.maxHp * LUKAS.innate.damage * defenseMult(UNIT_BY_ID.knight.mr)));
    const stunned = r.events.filter((e) => e.type === 'stun' && e.t === 0).map((e) => (e.type === 'stun' ? e.id : -1));
    expect(stunned.sort()).toEqual(hits.map((e) => (e.type === 'effect' ? e.target : -1)).sort());
  });

  test('from the front (with the card): the 3 tiles ahead at 50%, tearing defenses, no stun', () => {
    const r = fight(true);
    const hits = r.events.filter((e) => e.type === 'effect' && e.effect === BEAST_PIECE);
    expect(hits).toHaveLength(3);
    const knight = r.fighters.find((f) => f.side === 1)!;
    for (const e of hits) if (e.type === 'effect') expect(e.damage).toBe(Math.round(knight.maxHp * LUKAS.card.damage * defenseMult(UNIT_BY_ID.knight.mr)));
    expect(r.events.some((e) => e.type === 'stun' && e.t === 0)).toBe(false);
    const torn = r.events.filter((e) => e.type === 'debuff' && e.effect === BEAST_PIECE);
    expect(torn).toHaveLength(3);
    for (const e of torn) if (e.type === 'debuff') expect(e.armor).toBeCloseTo(UNIT_BY_ID.knight.armor * LUKAS.card.shred);
  });

  test("never hurts or stuns its own side, even when its allies are the densest crowd", () => {
    const state = game();
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
    }
    // Both beasts out; each side has a tight cluster and a lone unit.
    for (const [p, uid] of [[a, 100], [b, 200]] as const) {
      p.board[2 * BOARD_COLS + 3] = { uid, defId: BEAST_PIECE, star: 1 };
      [1, 2, BOARD_COLS + 1, BOARD_COLS + 2].forEach((cell, i) => (p.board[cell] = { uid: uid + 1 + i, defId: 'knight', star: 1 }));
      p.board[6] = { uid: uid + 9, defId: 'knight', star: 1 };
    }
    const r = simulateCombat({ rng: 1 }, a, b);
    const pieces = r.events.filter((e) => e.type === 'piece');
    expect(pieces.map((e) => (e.type === 'piece' ? e.side : -1)).sort()).toEqual([0, 1]);
    // Every beast hit and opening stun lands on one side only per beast: with both sides symmetric, each
    // side takes exactly what the other's beast dealt.
    const side = (id: number) => r.fighters.find((f) => f.id === id)!.side;
    const hits = r.events.filter((e) => e.type === 'effect' && e.effect === BEAST_PIECE);
    const per = [0, 1].map((s) => hits.filter((e) => e.type === 'effect' && side(e.target) === s).length);
    expect(per[0]).toBe(per[1]);
    expect(per[0]).toBeGreaterThan(0);
  });

  test('a lone beast only ever hits the other side', () => {
    const state = game();
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
    }
    a.board[2 * BOARD_COLS + 3] = { uid: 1, defId: BEAST_PIECE, star: 1 };
    // Its own side is packed right in front of it; the enemy is a single unit.
    [BOARD_COLS + 2, BOARD_COLS + 3, BOARD_COLS + 4, 2 * BOARD_COLS + 2, 2 * BOARD_COLS + 4].forEach((cell, i) => (a.board[cell] = { uid: 10 + i, defId: 'knight', star: 1 }));
    b.board[3] = { uid: 50, defId: 'knight', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const side = (id: number) => r.fighters.find((f) => f.id === id)!.side;
    const hits = r.events.filter((e) => e.type === 'effect' && e.effect === BEAST_PIECE);
    expect(hits).toHaveLength(1);
    for (const e of hits) if (e.type === 'effect') expect(side(e.target)).toBe(1);
    for (const e of r.events) if (e.type === 'stun' && e.t === 0) expect(side(e.id)).toBe(1);
  });
});

describe('Kagura', () => {
  function kaguraGame(): GameState {
    const state = createGame(5, SEEDS);
    expect(applyAction(state, 'you', { type: 'pickCommander', commander: 'kagura' }).ok).toBe(true);
    expect(applyAction(state, 'b', { type: 'pickCommander', commander: 'lukas' }).ok).toBe(true);
    return state;
  }

  test('marks one hero with the umbrella; it follows a merge and goes when the hero is sold', () => {
    const state = kaguraGame();
    const [p, lukas] = state.players;
    const hero = p.bench.find((u) => u)!;
    expect(applyAction(state, lukas.id, { type: 'mark', kind: 'ward', unit: lukas.bench.find((u) => u)!.uid }).ok).toBe(false); // Lukas has no umbrella
    expect(applyAction(state, p.id, { type: 'mark', kind: 'ward', unit: hero.uid }).ok).toBe(true);
    expect(markedUid(p, 'ward')).toBe(hero.uid);
    // Merged into another copy: the umbrella moves with it.
    const [x, y] = [{ uid: 801, defId: hero.defId, star: 2 as const }, null];
    const at = p.bench.indexOf(hero);
    p.bench[at] = y;
    p.board[0] = x;
    syncPlayer(state, p);
    expect(markedUid(p, 'ward')).toBe(801);
    // Sold: gone.
    expect(applyAction(state, p.id, { type: 'sell', from: { area: 'board', index: 0 } }).ok).toBe(true);
    expect(markedUid(p, 'ward')).toBeNull();
  });

  test('own card: +10 gold once, and a separate dance mark gives its hero +30% attack and magic attack and 20% hybrid lifesteal', () => {
    const state = kaguraGame();
    const p = state.players[0];
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    p.board[1] = { uid: 901, defId: 'kindler', star: 1 };
    applyAction(state, p.id, { type: 'mark', kind: 'ward', unit: 901 });
    const before = fieldStats(p, playerTraits(p), {}).get(900)!;
    // No dance before the card.
    expect(applyAction(state, p.id, { type: 'mark', kind: 'boost', unit: 900 }).ok).toBe(false);
    p.cardOffer = ['kagura'];
    const gold = p.gold;
    expect(applyAction(state, p.id, { type: 'pickCard', card: 'kagura' }).ok).toBe(true);
    expect(p.gold).toBe(gold + KAGURA.gold);
    // The dance goes on another hero than the umbrella: they're separate picks.
    expect(applyAction(state, p.id, { type: 'mark', kind: 'boost', unit: 900 }).ok).toBe(true);
    expect([markedUid(p, 'ward'), markedUid(p, 'boost')]).toEqual([901, 900]);
    expect(fieldStats(p, playerTraits(p), {}).get(901)!.atk).toBeCloseTo(before.atk, 0); // the umbrella hero gets no boost
    const after = fieldStats(p, playerTraits(p), {}).get(900)!;
    expect(after.atk).toBeCloseTo(before.atk * (1 + KAGURA.boost.hybridAtk), 0);
    expect(after.ap).toBeCloseTo(before.ap * (1 + KAGURA.boost.hybridAtk), 0);
    expect(after.lifesteal - before.lifesteal).toBeCloseTo(KAGURA.boost.hybridLifesteal);
    expect(after.spellLifesteal - before.spellLifesteal).toBeCloseTo(KAGURA.boost.hybridLifesteal);
  });

  test("on Lukas, Kagura's card lends the umbrella but not the gold or the boost", () => {
    const state = kaguraGame();
    const lukas = state.players[1];
    lukas.cardOffer = ['kagura'];
    const gold = lukas.gold;
    expect(applyAction(state, lukas.id, { type: 'pickCard', card: 'kagura' }).ok).toBe(true);
    expect(lukas.gold).toBe(gold);
    expect(powersOf(lukas)).toMatchObject({ ward: KAGURA.ward, beast: LUKAS.innate });
    expect(powersOf(lukas).boost).toBeUndefined();
  });

  test('in combat: the first drop under 50% opens a shield of 125% max hp, once', () => {
    const state = kaguraGame();
    const [a, b] = state.players;
    for (const p of state.players) {
      p.board.fill(null);
      p.bench.fill(null);
    }
    a.board[3] = { uid: 1, defId: 'knight', star: 1 };
    a.marks = { ward: { uid: 1, defId: 'knight' } };
    b.board[3] = { uid: 2, defId: 'titan', star: 3 };
    const r = simulateCombat({ rng: 1 }, a, b);
    const me = r.fighters.find((f) => f.side === 0)!;
    const opened = r.events.filter((e) => e.type === 'buff' && e.effect === 'umbrella');
    expect(opened).toHaveLength(1);
    expect(opened[0].type === 'buff' && opened[0].id).toBe(me.id);
    const shield = r.events.find((e) => e.type === 'shield' && e.id === me.id && e.t === opened[0].t);
    expect(shield?.type === 'shield' && shield.amount).toBe(Math.round(me.maxHp * KAGURA.ward.shield));
    // It opened on the hit that took it under half.
    const hit = r.events.filter((e) => (e.type === 'attack' || e.type === 'cast' || e.type === 'effect') && e.target === me.id && e.t <= opened[0].t).pop();
    expect(hit && 'hp' in hit && hit.hp).toBeLessThan(me.maxHp * KAGURA.ward.below);
  });
});

describe('Angela', () => {
  function angelaGame(): GameState {
    const state = createGame(5, SEEDS);
    expect(applyAction(state, 'you', { type: 'pickCommander', commander: 'angela' }).ok).toBe(true);
    expect(applyAction(state, 'b', { type: 'pickCommander', commander: 'lukas' }).ok).toBe(true);
    const p = state.players[0];
    p.board.fill(null);
    p.bench.fill(null);
    p.items = [];
    // Three heroes; the middle one holds the most items.
    p.board[0] = { uid: 900, defId: 'kindler', star: 1 };
    p.board[1] = { uid: 901, defId: 'kindler', star: 1 };
    p.board[2] = { uid: 902, defId: 'kindler', star: 1 };
    p.items = [
      { uid: 50, id: Object.keys(ITEMS)[0], tier: 1, holder: 901 },
      { uid: 51, id: Object.keys(ITEMS)[1], tier: 1, holder: 901 },
    ];
    return state;
  }

  test('innate: one halo you pick, plus the hero with the most items; both get +35% skill damage', () => {
    const state = angelaGame();
    const p = state.players[0];
    expect(autoHalo(p)).toBe(901);
    expect(applyAction(state, p.id, { type: 'mark', kind: 'halo', unit: 900 }).ok).toBe(true);
    expect(applyAction(state, p.id, { type: 'mark', kind: 'halo2', unit: 902 }).ok).toBe(false); // the card's second halo
    expect([...protectedUids(p)].sort()).toEqual([900, 901]);
    const stats = fieldStats(p, playerTraits(p), {});
    const base = unitStats(UNIT_BY_ID.kindler, 1).skillAmp;
    expect(stats.get(900)!.skillAmp - stats.get(902)!.skillAmp).toBeCloseTo(ANGELA.innate.skillAmp);
    expect(stats.get(902)!.skillAmp).toBeGreaterThanOrEqual(base);
  });

  test('the automatic halo moves on when the item holder is already picked', () => {
    const state = angelaGame();
    const p = state.players[0];
    applyAction(state, p.id, { type: 'mark', kind: 'halo', unit: 901 });
    expect(autoHalo(p)).not.toBe(901);
    expect(protectedUids(p).size).toBe(2);
  });

  test('own card: a second halo, 3 protected in all; on Lukas the card lends only the innate', () => {
    const state = angelaGame();
    const [p, lukas] = state.players;
    p.cardOffer = ['angela'];
    applyAction(state, p.id, { type: 'pickCard', card: 'angela' });
    expect(applyAction(state, p.id, { type: 'mark', kind: 'halo', unit: 900 }).ok).toBe(true);
    expect(applyAction(state, p.id, { type: 'mark', kind: 'halo2', unit: 902 }).ok).toBe(true);
    expect([...protectedUids(p)].sort()).toEqual([900, 901, 902]);
    lukas.cardOffer = ['angela'];
    applyAction(state, lukas.id, { type: 'pickCard', card: 'angela' });
    expect(powersOf(lukas).protect).toEqual(ANGELA.innate);
    expect(markKinds(lukas)).toEqual(['halo']);
  });

  test('in combat: a protected hero gets 20% of its max mana back after casting', () => {
    const state = angelaGame();
    const [a, b] = state.players;
    a.items = [];
    a.board.fill(null);
    a.board[3] = { uid: 1, defId: 'kindler', star: 1 };
    a.marks = { halo: { uid: 1, defId: 'kindler' } };
    b.board.fill(null);
    b.bench.fill(null);
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    // Mana on the first attack after the first cast, with and without the halo.
    const manaAfterCast = () => {
      const r = simulateCombat({ rng: 1 }, a, b);
      const me = r.fighters.find((f) => f.side === 0 && f.defId === 'kindler')!;
      const cast = r.events.findIndex((e) => e.type === 'skill' && e.id === me.id);
      expect(cast).toBeGreaterThan(-1);
      const next = r.events.slice(cast + 1).find((e) => (e.type === 'attack' || e.type === 'skill') && e.id === me.id);
      if (next?.type !== 'attack') throw new Error('no attack after the cast');
      return { mana: next.mana, max: me.maxMana };
    };
    const blessed = manaAfterCast();
    a.commander = 'lukas'; // no protection at all (no beast on the board either)
    const plain = manaAfterCast();
    expect(blessed.mana - plain.mana).toBe(Math.floor(blessed.max * ANGELA.innate.refund));
  });
});
