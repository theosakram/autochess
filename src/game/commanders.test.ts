import { altarStatus } from './altar';
import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { EQUIPMENT } from './items';
import { openChest } from './inventory';
import { killsBy, type CombatResult } from './combat';
import { earnChests, payBounty } from './game';
import { ALICE, AMON, CYCLOPS, FREYA, GUINESS, JOHNSON, LUNOX, MIYA } from './commanders';
import { refreshShop, rollFreeHero, shopPrice } from './shop';
import { claimable } from './freya';
import { checkRally, heroValue, payHeirs } from './cyclops';
import { bloodStars } from './blood';
import { copiesOf, mergeUnits } from './merge';
import { SHOP_ODDS, STAR_MULT } from './config';
import { ICE_LONGBOW } from './items';
import { playerTraitCounts } from './traits';
import { ANGELA, autoHalo, BEAST_PIECE, beastOf, cardFace, DYROTH, hurtPlayer, KAELA, KAGURA, KENZO, LUKAS, NANA, payCard, RUBY, markedUid, markKinds, powersOf, protectedUids } from './commanders';
import { ITEMS } from './items';
import { fieldStats } from './inventory';
import { syncPlayer } from './sync';
import { playerTraits, TRAITS, unitStats } from './traits';
import { simulateCombat, defenseMult } from './combat';
import { BOARD_COLS, COMMANDER_CARD_ROUND, roundAt, WIN_GOLD } from './config';
import { createGame, resolveCombat, startRound } from './game';
import { cardRolls, payPrize, PRIZE_VALUES } from './luckyDice';
import { boardCount } from './player';
import type { GameState, Player } from './types';
import { UNIT_BY_ID, UNITS } from './units';

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

// A made-up fight: fighter 0 (holding the Black Sash) and 1 against 2..; each entry is a [dealer, target] kill.
function killFight(kills: [number, number][]): CombatResult {
  const fighter = (id: number, side: 0 | 1, items: { id: string; tier: number }[] = []) => ({ id, side, items });
  return {
    fighters: [fighter(0, 0, [{ id: 'blacksash', tier: 1 }]), fighter(1, 0), ...kills.map((_, i) => fighter(i + 2, 1))],
    events: kills.map(([id, target]) => ({ t: 1, type: 'attack', id, target, damage: 50, hp: 0, mana: 0, targetMana: 0 })),
  } as unknown as CombatResult;
}

describe('Kenzo', () => {
  function kenzoGame() {
    const state = createGame(5, SEEDS);
    for (const p of state.players) applyAction(state, p.id, { type: 'pickCommander', commander: 'kenzo' });
    return state;
  }

  test('a win pays 1 extra gold, a loss 2', () => {
    const state = kenzoGame();
    state.round = 3;
    const [strong, weak] = state.players;
    strong.board = strong.board.map(() => null);
    weak.board = weak.board.map(() => null);
    strong.board[3] = { uid: 901, defId: 'knight', star: 3 };
    weak.board[3] = { uid: 902, defId: 'footman', star: 1 };
    strong.gold = weak.gold = 0;
    const [fight] = resolveCombat(state);
    expect(fight.result.winner).not.toBeNull();
    const winner = state.players.find((p) => p.id === (fight.result.winner === 0 ? fight.home : fight.away))!;
    const loser = state.players.find((p) => p !== winner)!;
    expect(winner.gold).toBe(KENZO.gold.win + WIN_GOLD); // plus the +1 any win pays
    expect(loser.gold).toBe(KENZO.gold.loss);
  });

  test('another commander taking the card gets the gold, not the sash', () => {
    const state = game();
    const p = state.players[0];
    p.cardOffer = ['kenzo'];
    applyAction(state, p.id, { type: 'pickCard', card: 'kenzo' });
    expect(powersOf(p).roundGold).toEqual(KENZO.gold);
    expect(p.items.some((i) => i.id === 'blacksash')).toBe(false);
  });

  test('his own card hands over the sash and keeps his gold', () => {
    const state = kenzoGame();
    const p = state.players[0];
    p.cardOffer = ['kenzo'];
    applyAction(state, p.id, { type: 'pickCard', card: 'kenzo' });
    expect(p.items.filter((i) => i.id === 'blacksash')).toHaveLength(1);
    expect(powersOf(p).roundGold).toEqual(KENZO.gold);
  });

  test('the sash is +60% attack and magic attack, and never drops', () => {
    expect(EQUIPMENT).not.toContain('blacksash');
    expect(ITEMS.blacksash.mods(1)).toEqual([{ stat: 'atk', pct: 0.6 }, { stat: 'ap', pct: 0.6 }]);
  });

  test('only kills by the holder or its summons count, once per target', () => {
    const result = killFight([[0, 2], [1, 3], [0, 3], [0, 4]]);
    expect(killsBy(result, [0])).toBe(2);
    result.events.unshift({ t: 0, type: 'summon', owner: 0, fighter: { id: 9 } } as never, { t: 0, type: 'attack', id: 9, target: 7, damage: 5, hp: 0, mana: 0, targetMana: 0 });
    expect(killsBy(result, [0])).toBe(3);
  });

  test('every 4 last hits by the holder earn a chest, kept across fights, up to 4', () => {
    const state = kenzoGame();
    const p = state.players[0];
    earnChests(p, killFight([[0, 2], [0, 3]]), 0);
    expect(p.chests).toEqual({ kills: 2, earned: 0, waiting: 0 });
    earnChests(p, killFight([[0, 2], [0, 3], [1, 4]]), 0); // 2 more by the holder (4 in all); 1 by an ally doesn't count
    expect(p.chests).toEqual({ kills: 0, earned: 1, waiting: 1 });
    earnChests(p, killFight(Array.from({ length: 30 }, (_, i): [number, number] => [0, i + 2])), 0);
    expect(p.chests!.earned).toBe(4);
    expect(p.chests!.waiting).toBe(4);
  });

  test('a chest offers 3 equipment to pick from; the next opens after the pick; the fight picks for you', () => {
    const state = kenzoGame();
    const p = state.players[0];
    p.chests = { kills: 0, earned: 3, waiting: 3 };
    const before = p.items.length;
    openChest(state, p);
    expect(p.itemOffer).toHaveLength(3);
    expect(new Set(p.itemOffer).size).toBe(3);
    for (const id of p.itemOffer!) expect(EQUIPMENT).toContain(id);
    expect(applyAction(state, p.id, { type: 'pickItem', item: p.itemOffer![1] }).ok).toBe(true);
    expect(p.items).toHaveLength(before + 1);
    expect(p.itemOffer).toHaveLength(3);
    expect(p.chests.waiting).toBe(1);
    state.round = 3;
    resolveCombat(state);
    expect(p.items).toHaveLength(before + 3);
    expect(p.itemOffer).toBeUndefined();
  });

  test('real fights count: a strong sash holder earns kills and chests', () => {
    const state = kenzoGame();
    state.round = 3;
    const [a, b] = state.players;
    a.board = a.board.map(() => null);
    b.board = b.board.map(() => null);
    a.board[3] = { uid: 901, defId: 'knight', star: 3 };
    a.items.push({ uid: 903, id: 'blacksash', tier: 1, holder: 901 });
    for (let c = 0; c < 4; c++) b.board[c] = { uid: 910 + c, defId: 'footman', star: 1 };
    resolveCombat(state);
    expect((a.chests?.kills ?? 0) + (a.chests?.earned ?? 0) * 3).toBeGreaterThan(0);
  });
});

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
    p.bench[0] = { uid: 999, defId: 'cici', star: 1 };
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
    p.board[0] = { uid: 900, defId: 'cici', star: 1 };
    p.board[1] = { uid: 901, defId: 'cici', star: 1 };
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
    p.board[0] = { uid: 900, defId: 'cici', star: 1 };
    p.board[1] = { uid: 901, defId: 'cici', star: 1 };
    p.board[2] = { uid: 902, defId: 'cici', star: 1 };
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
    const base = unitStats(UNIT_BY_ID.cici, 1).skillAmp;
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

  test('own card: the Love Beam (no extra halo); on Lukas the card lends only the innate', () => {
    const state = angelaGame();
    const [p, lukas] = state.players;
    p.cardOffer = ['angela'];
    applyAction(state, p.id, { type: 'pickCard', card: 'angela' });
    expect(powersOf(p).loveBeam).toEqual(ANGELA.loveBeam);
    expect(markKinds(p)).toEqual(['halo']);
    lukas.cardOffer = ['angela'];
    applyAction(state, lukas.id, { type: 'pickCard', card: 'angela' });
    expect(powersOf(lukas).protect).toEqual(ANGELA.innate);
    expect(powersOf(lukas).loveBeam).toBeUndefined();
  });

  test('Love Beam: every 3s a protected hero beams through its target, healing allies on the line and hitting enemies, harder by stage', () => {
    const state = angelaGame();
    const [a, b] = state.players;
    a.items = [];
    a.board.fill(null);
    a.board[2 * BOARD_COLS + 3] = { uid: 1, defId: 'cici', star: 1 }; // back row, middle
    a.board[3] = { uid: 2, defId: 'knight', star: 1 }; // front row, same column: on the line
    a.marks = { halo: { uid: 1, defId: 'cici' } };
    a.commanderCard = 'angela';
    b.board.fill(null);
    b.bench.fill(null);
    b.items = [];
    b.board[BOARD_COLS - 1 - 3] = { uid: 3, defId: 'paladin', star: 3 }; // straight ahead
    const run = (round: number) => simulateCombat({ rng: 1 }, a, b, { round });
    const r = run(1);
    const beamer = r.fighters.find((f) => f.side === 0 && f.defId === 'cici')!.id;
    const knight = r.fighters.find((f) => f.side === 0 && f.defId === 'knight')!.id;
    const every = ANGELA.loveBeam.every * 10;
    const hits = r.events.filter((e) => e.type === 'effect' && e.effect === 'lovebeam');
    expect(hits.length).toBeGreaterThan(0);
    // Both protected heroes beam: the haloed one, and the automatic one (the knight, on the tie-break).
    expect(hits.every((e) => e.type === 'effect' && (e.by === beamer || e.by === knight) && e.t % every === 0)).toBe(true);
    expect(hits.some((e) => e.type === 'effect' && e.by === beamer)).toBe(true);
    const heals = r.events.filter((e) => e.type === 'heal' && e.id === knight && e.t % every === 0);
    expect(heals.length).toBeGreaterThan(0);
    // Stage II beams twice as hard as stage I (same target, same resist).
    const first = (res: CombatResult) => (res.events.find((e) => e.type === 'effect' && e.effect === 'lovebeam') as { damage: number }).damage;
    expect(first(run(roundAt(2, 1))) / first(r)).toBeCloseTo(ANGELA.loveBeam.damage[1] / ANGELA.loveBeam.damage[0], 1);
    // Without the card, no beam.
    a.commanderCard = null;
    expect(run(1).events.some((e) => e.type === 'effect' && e.effect === 'lovebeam')).toBe(false);
  });

  test('in combat: a protected hero gets 20% of its max mana back after casting', () => {
    const state = angelaGame();
    const [a, b] = state.players;
    a.items = [];
    a.board.fill(null);
    a.board[3] = { uid: 1, defId: 'cici', star: 1 };
    a.marks = { halo: { uid: 1, defId: 'cici' } };
    b.board.fill(null);
    b.bench.fill(null);
    b.board[3] = { uid: 2, defId: 'knight', star: 2 };
    // Mana on the first attack after the first cast, with and without the halo.
    const manaAfterCast = () => {
      const r = simulateCombat({ rng: 1 }, a, b);
      const me = r.fighters.find((f) => f.side === 0 && f.defId === 'cici')!;
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

describe('Nana', () => {
  function nanaGame(): { state: GameState; p: Player } {
    const state = createGame(5, SEEDS);
    for (const p of state.players) expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'nana' }).ok).toBe(true);
    return { state, p: state.players[0] };
  }

  test('survives the first knockout at 1 HP; the second one knocks her out', () => {
    const { p } = nanaGame();
    p.hp = 5;
    hurtPlayer(p, 20);
    expect(p.hp).toBe(1);
    expect(p.deathsSaved).toBe(1);
    hurtPlayer(p, 3);
    expect(p.hp).toBeLessThanOrEqual(0);
  });

  test('every 10 damage taken pays 10 gold, 3 times at most; the third also gives an Equipment Chest', () => {
    const { p } = nanaGame();
    const gold = p.gold;
    hurtPlayer(p, 7);
    expect(p.gold).toBe(gold);
    hurtPlayer(p, 7); // 14: one payout
    expect(p.gold).toBe(gold + NANA.hurtGold.gold);
    expect(p.chests?.waiting ?? 0).toBe(0);
    hurtPlayer(p, 20); // 34: two more at once, the last with a chest
    expect(p.gold).toBe(gold + 3 * NANA.hurtGold.gold);
    expect(p.chests!.waiting).toBe(1);
    hurtPlayer(p, 30); // capped
    expect(p.gold).toBe(gold + 3 * NANA.hurtGold.gold);
    expect(p.chests!.waiting).toBe(1);
  });

  test('a lost fight goes through it: damage gold and the 1 HP save', () => {
    const { state, p } = nanaGame();
    const [, b] = state.players;
    p.board.fill(null);
    p.bench.fill(null);
    b.board[3] = { uid: 999, defId: 'titan', star: 3 };
    p.hp = 2;
    p.hurt = { taken: NANA.hurtGold.every - 1, paid: 0 }; // one point short of a payout
    const gold = p.gold;
    resolveCombat(state);
    expect(p.hp).toBe(1);
    expect(p.place).toBeNull();
    expect(p.gold).toBeGreaterThan(gold);
  });

  test('Leaf Disguise on Nana: a chest offer right away, 8 gold, and two knockout saves', () => {
    const { state, p } = nanaGame();
    while (state.round < COMMANDER_CARD_ROUND) {
      resolveCombat(state);
      startRound(state);
    }
    // Clear the round's basic item pick, so the chest can open straight away.
    while (p.itemOffer?.length) expect(applyAction(state, p.id, { type: 'pickItem', item: p.itemOffer[0] }).ok).toBe(true);
    const gold = p.gold;
    expect(applyAction(state, p.id, { type: 'pickCard', card: 'nana' }).ok).toBe(true);
    expect(p.gold).toBe(gold + NANA.card.gold);
    expect(p.itemOffer?.every((id) => EQUIPMENT.includes(id))).toBe(true);
    expect(powersOf(p).deathSaves).toBe(2);
    expect(powersOf(p).hurtGold).toEqual(NANA.hurtGold); // kept from the innate
    p.hp = 1;
    hurtPlayer(p, 50);
    expect(p.hp).toBe(1);
    hurtPlayer(p, 50);
    expect(p.hp).toBe(1);
    hurtPlayer(p, 50);
    expect(p.hp).toBeLessThanOrEqual(0);
  });

  test('on another commander, her card lends her innate power: one save and the damage gold', () => {
    const { p } = nanaGame();
    p.commander = 'lukas';
    p.commanderCard = 'nana';
    expect(cardFace(p, 'nana').self).toBe(false);
    expect(powersOf(p).deathSaves).toBe(NANA.deathSaves.innate);
    expect(powersOf(p).hurtGold).toEqual(NANA.hurtGold);
  });
});

describe('Kaela', () => {
  function kaelaGame(): { state: GameState; p: Player } {
    const state = createGame(5, SEEDS);
    for (const p of state.players) expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'kaela' }).ok).toBe(true);
    return { state, p: state.players[0] };
  }
  // What a prize handed over, in gold: gold itself, plus each kind of thing at its set value.
  const worth = (p: Player) =>
    p.gold +
    p.items.length * PRIZE_VALUES.equipment +
    (p.mistOrbs?.length ?? 0) * PRIZE_VALUES.factionorb +
    (p.mirrors ?? 0) * PRIZE_VALUES.mirror +
    [...p.bench, ...p.board].reduce((n, u) => n + (u && UNIT_BY_ID[u.defId].tier >= 4 ? PRIZE_VALUES[`hero${UNIT_BY_ID[u.defId].tier}`] : 0), 0);

  test('a roll a round for 1-4 points; going past 8 drops back to 0', () => {
    const { state, p } = kaelaGame();
    expect(applyAction(state, p.id, { type: 'rollDice' }).ok).toBe(true);
    expect(p.trove!.points).toBeGreaterThanOrEqual(1);
    expect(p.trove!.points).toBeLessThanOrEqual(KAELA.trove.die);
    expect(applyAction(state, p.id, { type: 'rollDice' }).ok).toBe(false); // one a round
    // Next rounds: from 7, anything but a 1 goes bust.
    for (let i = 0; i < 20; i++) {
      state.round++;
      p.trove!.points = 7;
      expect(applyAction(state, p.id, { type: 'rollDice' }).ok).toBe(true);
      expect(p.trove!.points).toBe(p.trove!.lastRoll === 1 ? 8 : 0);
      expect(p.trove!.bust).toBe(p.trove!.lastRoll !== 1);
    }
  });

  test('unused rolls bank up: skip two rounds, roll three times', () => {
    const { state, p } = kaelaGame();
    state.round += 2;
    for (let i = 0; i < 3; i++) expect(applyAction(state, p.id, { type: 'rollDice' }).ok).toBe(true);
    expect(applyAction(state, p.id, { type: 'rollDice' }).ok).toBe(false);
    state.round++;
    expect(applyAction(state, p.id, { type: 'rollDice' }).ok).toBe(true);
  });

  test('opening pays a prize worth its points, resets them, and works 3 times a game', () => {
    const { state, p } = kaelaGame();
    expect(applyAction(state, p.id, { type: 'openTrove' }).ok).toBe(false); // nothing to cash in
    p.bench.fill(null);
    p.board.fill(null);
    for (let i = 0; i < KAELA.trove.opens; i++) {
      p.trove!.points = KAELA.trove.max;
      const before = worth(p);
      expect(applyAction(state, p.id, { type: 'openTrove' }).ok).toBe(true);
      expect(worth(p) - before).toBe(KAELA.trove.value[KAELA.trove.max]);
      expect(p.trove!.points).toBe(0);
      expect(p.luck!.last).toBeTruthy();
    }
    p.trove!.points = 3;
    expect(applyAction(state, p.id, { type: 'openTrove' }).ok).toBe(false);
    state.round++;
    expect(applyAction(state, p.id, { type: 'rollDice' }).ok).toBe(false); // spent
  });

  test('a prize too small for anything else is just gold', () => {
    const { state, p } = kaelaGame();
    for (let i = 0; i < 20; i++) {
      const gold = p.gold;
      const items = p.items.length;
      payPrize(state, p, 3);
      expect(p.gold - gold).toBe(3);
      expect(p.items.length).toBe(items);
    }
  });

  test('prizes come in every kind, each worth exactly its value', () => {
    const { state, p } = kaelaGame();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      p.bench.fill(null);
      p.board.fill(null);
      const before = worth(p);
      const text = payPrize(state, p, 16);
      expect(worth(p) - before).toBe(16);
      seen.add(text.replace(/ \+ \d+ gold$/, '').replace(/^\d+ gold$/, 'gold').replace(/^.* orb$/, 'orb').replace(/^[^a-z]+ .*/, 'equipment'));
    }
    for (const kind of ['gold', 'a random 4-gold hero', 'a random 5-gold hero', 'orb', 'a Mirror Device', 'equipment']) expect(seen).toContain(kind);
  });

  test('a Mirror Device copies a unit', () => {
    const { state, p } = kaelaGame();
    p.bench.fill(null);
    p.board.fill(null);
    p.board[0] = { uid: 500, defId: 'cici', star: 1 };
    p.mirrors = 1;
    expect(applyAction(state, p.id, { type: 'useMirror', unit: 500 }).ok).toBe(true);
    expect(p.mirrors).toBe(0);
    expect([...p.bench, ...p.board].filter((u) => u?.defId === 'cici').length).toBe(2);
    expect(applyAction(state, p.id, { type: 'useMirror', unit: 500 }).ok).toBe(false);
  });

  test('Lucky Streak on Kaela: a prize on the pick (I-2) and another on III-1, 21-35 gold worth in all', () => {
    const { state, p } = kaelaGame();
    while (state.round < COMMANDER_CARD_ROUND) {
      resolveCombat(state);
      startRound(state);
    }
    p.bench.fill(null);
    p.board.fill(null);
    let before = worth(p);
    expect(applyAction(state, p.id, { type: 'pickCard', card: 'kaela' }).ok).toBe(true);
    const first = worth(p) - before;
    expect(first).toBeGreaterThanOrEqual(KAELA.rolls[0].min);
    expect(first).toBeLessThanOrEqual(KAELA.rolls[0].max);
    expect(p.luck!.rolled).toEqual([2]);
    expect(powersOf(p).trove).toEqual(KAELA.trove); // the Grove stays
    // III-1's roll, by itself (the round's own income and fight left out).
    state.round = KAELA.rolls[1].round - 1;
    p.bench.fill(null);
    p.board.fill(null);
    before = worth(p);
    state.round = KAELA.rolls[1].round;
    cardRolls(state, p);
    const second = worth(p) - before;
    expect(second).toBeGreaterThanOrEqual(KAELA.rolls[1].min);
    expect(second).toBeLessThanOrEqual(KAELA.rolls[1].max);
    expect(p.luck!.rolled).toEqual([2, roundAt(3, 1)]);
    cardRolls(state, p); // never twice
    expect(worth(p) - before).toBe(second);
  });

  test('on another commander, her card gives the free rolls, not the Treasure Grove', () => {
    const { p } = kaelaGame();
    p.commander = 'lukas';
    p.commanderCard = 'kaela';
    expect(powersOf(p).luckyRolls).toEqual(KAELA.rolls);
    expect(powersOf(p).trove).toBeUndefined();
  });
});

describe('Ruby', () => {
  test('picking her hands over the Cloak and the Scythe', () => {
    const state = createGame(5, SEEDS);
    const p = state.players[0];
    expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'ruby' }).ok).toBe(true);
    expect(p.items.map((i) => i.id).sort()).toEqual(['redcloak', 'scythe']);
    expect(p.items.every((i) => i.holder === null)).toBe(true);
  });

  test('on another commander, her card lends them both items, handed over with the card', () => {
    const state = createGame(5, SEEDS);
    const p = state.players[0];
    p.commander = 'lukas';
    const before = p.items.length;
    payCard(state, p, 'ruby');
    expect(p.items.slice(before).map((i) => i.id).sort()).toEqual(['redcloak', 'scythe']);
    expect(powersOf(p).survivorGold).toBeUndefined();
  });

  test("Hunter's Bounty: +2 gold per Cloak and Scythe wearer standing after a fight, 35 gold a game at most", () => {
    const state = createGame(5, SEEDS);
    const p = state.players[0];
    p.commander = 'ruby';
    p.commanderCard = 'ruby';
    // Fighter 0 holds both, 1 a Cloak, 2 a Scythe (dies in the first fight); the enemy's Scythe doesn't count.
    const fight = (deadIds: number[]) =>
      ({
        fighters: [
          { id: 0, side: 0, items: [{ id: 'redcloak' }, { id: 'scythe' }] },
          { id: 1, side: 0, items: [{ id: 'redcloak' }] },
          { id: 2, side: 0, items: [{ id: 'scythe' }] },
          { id: 3, side: 1, items: [{ id: 'scythe' }] },
        ],
        events: deadIds.map((id) => ({ t: 1, type: 'death', id })),
      }) as unknown as CombatResult;
    const gold = p.gold;
    payBounty(p, fight([2]), 0);
    expect(p.gold - gold).toBe(3 * RUBY.survivorGold.gold);
    for (let i = 0; i < 20; i++) payBounty(p, fight([]), 0);
    expect(p.gold - gold).toBe(RUBY.survivorGold.max);
    expect(p.survivorGold).toBe(RUBY.survivorGold.max);
  });
});

describe('Dyroth', () => {
  function dyrothGame(): { state: GameState; p: Player } {
    const state = createGame(5, SEEDS);
    for (const p of state.players) expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'dyroth' }).ok).toBe(true);
    const p = state.players[0];
    p.bench.fill(null);
    p.board.fill(null);
    return { state, p };
  }
  const owned = (p: Player) => [...p.bench, ...p.board].filter((u) => u !== null).map((u) => u!.defId);

  test('the Demon Altar opens on round 3: a 4-gold Gustiwana Deadeye gives a 5-gold Gustiwana and a 5-gold Deadeye', () => {
    const { state, p } = dyrothGame();
    const def = UNITS.find((u) => u.tier === 4 && u.traits.includes('gustiwana') && u.traits.includes('deadeye'));
    // Any 4-gold hero with a faction and a role works the same; prefer the example if the roster has it.
    const hero = def ?? UNITS.find((u) => u.tier === 4 && u.shop !== false && u.traits.some((t) => TRAITS[t].kind === 'faction') && u.traits.some((t) => TRAITS[t].kind === 'role'))!;
    p.bench[0] = { uid: 700, defId: hero.id, star: 1 };
    state.round = 2;
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 700 }).ok).toBe(false); // not yet
    state.round = DYROTH.altar.first;
    const pool = state.pool[hero.id];
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 700 }).ok).toBe(true);
    expect(state.pool[hero.id]).toBe(pool + 1); // its copy is back
    const gifts = owned(p).map((id) => UNIT_BY_ID[id]);
    expect(gifts.length).toBe(2);
    for (const g of gifts) expect(g.tier).toBe(5);
    const faction = hero.traits.find((t) => TRAITS[t].kind === 'faction')!;
    const role = hero.traits.find((t) => TRAITS[t].kind === 'role')!;
    // One shares its faction, one its role (unless none of that cost has it: then any of that cost).
    const has = (t: string) => UNITS.some((u) => u.tier === 5 && u.shop !== false && !u.locked && u.traits.includes(t));
    if (has(faction)) expect(gifts.some((g) => g.traits.includes(faction))).toBe(true);
    if (has(role)) expect(gifts.some((g) => g.traits.includes(role))).toBe(true);
    expect([...p.bench, ...p.board].every((u) => !u || u.star === 1)).toBe(true);
  });

  test('then it recharges for 4 rounds; a 5-gold hero becomes 7-gold; 7-gold and reward units are refused', () => {
    const { state, p } = dyrothGame();
    const five = UNITS.find((u) => u.tier === 5 && u.shop !== false)!;
    const seven = UNITS.find((u) => u.tier === 7 && u.shop !== false)!;
    const reward = UNITS.find((u) => u.shop === false && !u.summon && !u.monster && !u.piece)!;
    state.round = 3;
    p.bench[0] = { uid: 701, defId: seven.id, star: 1 };
    p.bench[1] = { uid: 702, defId: reward.id, star: 1 };
    p.bench[2] = { uid: 703, defId: five.id, star: 1 };
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 701 }).ok).toBe(false);
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 702 }).ok).toBe(false);
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 703 }).ok).toBe(true);
    for (const id of owned(p).filter((id) => id !== seven.id && id !== reward.id)) expect(UNIT_BY_ID[id].tier).toBe(7);
    p.bench[0] = null;
    p.bench[1] = { uid: 704, defId: five.id, star: 1 };
    state.round = 6;
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 704 }).ok).toBe(false);
    state.round = 3 + DYROTH.altar.every;
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 704 }).ok).toBe(true);
  });

  test("an offered hero's items go back to the inventory; gifts wait for bench room", () => {
    const { state, p } = dyrothGame();
    state.round = 3;
    const hero = UNITS.find((u) => u.tier === 2 && u.shop !== false)!;
    p.board[0] = { uid: 705, defId: hero.id, star: 2 };
    p.items = [{ uid: 900, id: 'waraxe', tier: 1, holder: 705 }];
    for (let i = 0; i < p.bench.length; i++) p.bench[i] = { uid: 800 + i, defId: 'footman', star: 1 }; // full
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 705 }).ok).toBe(true);
    expect(p.items[0].holder).toBeNull();
    expect(p.gifts!.length).toBe(2);
    p.bench[0] = null;
    p.bench[1] = null;
    syncPlayer(state, p);
    expect(p.gifts!.length).toBe(0);
    expect(p.bench.slice(0, 2).every((u) => u && UNIT_BY_ID[u.defId].tier === 3)).toBe(true);
  });

  test('Abyss Altar on Dyroth: a second altar, ready on the pick, a random hero 1 cost up, every 3 rounds', () => {
    const { state, p } = dyrothGame();
    p.commanderCard = 'dyroth';
    state.round = 2;
    const hero = UNITS.find((u) => u.tier === 1 && u.shop !== false)!;
    p.bench[0] = { uid: 706, defId: hero.id, star: 1 };
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 706 }).ok).toBe(false); // the first one waits for round 3
    expect(applyAction(state, p.id, { type: 'offer', altar: 'secondAltar', unit: 706 }).ok).toBe(true);
    expect(owned(p).map((id) => UNIT_BY_ID[id].tier)).toEqual([2]);
    p.bench[1] = { uid: 707, defId: hero.id, star: 1 };
    state.round = 4;
    expect(applyAction(state, p.id, { type: 'offer', altar: 'secondAltar', unit: 707 }).ok).toBe(false);
    state.round = 2 + DYROTH.secondAltar.every;
    expect(applyAction(state, p.id, { type: 'offer', altar: 'secondAltar', unit: 707 }).ok).toBe(true);
    // Both altars work side by side.
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: [...p.bench].find((u) => u)!.uid }).ok).toBe(true);
  });

  test('altar uses stack: unspent ones bank, the countdown keeps going, each offering spends one', () => {
    const { state, p } = dyrothGame();
    const a = DYROTH.altar;
    state.round = a.first - 1;
    expect(altarStatus(p, 'altar', state.round)).toEqual({ uses: 0, next: a.first });
    state.round = a.first + 2 * a.every; // three uses earned, none spent
    expect(altarStatus(p, 'altar', state.round)).toEqual({ uses: 3, next: a.first + 3 * a.every });
    const hero = UNITS.find((u) => u.tier === 1 && u.shop !== false)!;
    for (let i = 0; i < 4; i++) p.bench[i] = { uid: 720 + i, defId: hero.id, star: 1 };
    p.level = 5; // 20 xp to the next level: no level-up in the way
    p.xp = 0;
    for (let i = 0; i < 3; i++) expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 720 + i }).ok).toBe(true);
    expect(p.level).toBe(5);
    expect(p.xp).toBe(3 * a.xp); // 2 XP an offering
    expect(a.xp).toBe(2);
    expect(DYROTH.secondAltar.xp).toBe(2);
    expect(applyAction(state, p.id, { type: 'offer', altar: 'altar', unit: 723 }).ok).toBe(false); // all spent
    expect(altarStatus(p, 'altar', state.round)).toEqual({ uses: 0, next: a.first + 3 * a.every });
    state.round = a.first + 3 * a.every;
    expect(altarStatus(p, 'altar', state.round).uses).toBe(1);
  });

  test('on another commander, his card lends the Demon Altar', () => {
    const { p } = dyrothGame();
    p.commander = 'lukas';
    p.commanderCard = 'dyroth';
    expect(powersOf(p).altar).toEqual(DYROTH.altar);
    expect(powersOf(p).secondAltar).toBeUndefined();
  });
});

describe('Lunox', () => {
  // Both players on Lunox (or `other` for the second), cards picked, boards cleared.
  function lunoxGame(card: string, commander = 'lunox'): { state: GameState; p: Player } {
    const state = createGame(9, SEEDS);
    const p = state.players[0];
    expect(applyAction(state, p.id, { type: 'pickCommander', commander }).ok).toBe(true);
    expect(applyAction(state, state.players[1].id, { type: 'pickCommander', commander: 'lukas' }).ok).toBe(true);
    p.bench.fill(null);
    p.board.fill(null);
    p.gold = 0;
    p.cardOffer = [card];
    expect(applyAction(state, p.id, { type: 'pickCard', card }).ok).toBe(true);
    return { state, p };
  }

  test('the blessing is innate: it (plus 6 gold) comes with picking Lunox, before any card, and only once', () => {
    const state = createGame(9, SEEDS);
    const p = state.players[0];
    const before = p.gold;
    expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'lunox' }).ok).toBe(true);
    expect(p.twilight).toEqual({ holder: null, trait: null });
    expect(p.gold).toBe(before + LUNOX.twilight.gold);
    // Any card later (his own included) hands out no second blessing or its gold.
    const { p: q } = lunoxGame('lukas');
    expect(q.twilight).toEqual({ holder: null, trait: null });
    expect(q.gold).toBe(0);
  });

  test("on another commander, Lunox's card brings the blessing", () => {
    const { p } = lunoxGame('lunox', 'lukas');
    expect(p.twilight).toEqual({ holder: null, trait: null });
    expect(p.gold).toBe(LUNOX.other.gold);
  });

  test('blessing a hero rolls one of its own traits, +1 on top of the Magic Orb, and gives 2 heroes of it (costs by shop odds)', () => {
    const { state, p } = lunoxGame('lunox');
    p.board[3] = { uid: 950, defId: 'dyroth', star: 1 }; // Gustiwana Fighter
    p.orb = { defId: 'dyroth', trait: 'gustiwana' };
    const before = playerTraitCounts(p);
    expect(applyAction(state, p.id, { type: 'bless', unit: 950 }).ok).toBe(true);
    const trait = p.twilight!.trait!;
    expect(['gustiwana', 'fighter']).toContain(trait);
    expect(playerTraitCounts(p)[trait]).toBe((before[trait] ?? 0) + 1);
    expect(before.gustiwana).toBe(2); // the hero plus the orb; a Gustiwana roll makes it 3
    expect(p.twilight!.gifts).toHaveLength(LUNOX.twilight.heroes);
    expect(LUNOX.twilight.heroes).toBe(2);
    for (const id of p.twilight!.gifts!) {
      expect(UNIT_BY_ID[id].traits).toContain(trait);
      expect(SHOP_ODDS[p.level - 1][UNIT_BY_ID[id].tier - 1]).toBeGreaterThan(0); // a cost this level's shop rolls
    }
    expect(applyAction(state, p.id, { type: 'bless', unit: 950 }).ok).toBe(false); // once
  });

  test('the gifted heroes follow the shop odds: at a high level, pricier ones turn up', () => {
    const tiers = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const state = createGame(seed, SEEDS);
      const p = state.players[0];
      expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'lunox' }).ok).toBe(true);
      p.level = 10;
      p.bench.fill(null);
      p.board.fill(null);
      p.board[3] = { uid: 950, defId: 'dyroth', star: 1 };
      expect(applyAction(state, p.id, { type: 'bless', unit: 950 }).ok).toBe(true);
      for (const id of p.twilight!.gifts!) tiers.add(UNIT_BY_ID[id].tier);
    }
    expect([...tiers].some((t) => t >= 3)).toBe(true);
  });

  test('it stays with that very hero: a second copy has none, and selling the hero loses it', () => {
    const { state, p } = lunoxGame('lukas');
    p.bench.fill(null);
    p.board[3] = { uid: 951, defId: 'dyroth', star: 1 };
    expect(applyAction(state, p.id, { type: 'bless', unit: 951 }).ok).toBe(true);
    p.bench.fill(null); // drop the gifted heroes so they don't count
    const trait = p.twilight!.trait!;
    expect(playerTraitCounts(p)[trait]).toBe(2);
    p.board[4] = { uid: 952, defId: 'siyunyin', star: 1 };
    expect(applyAction(state, p.id, { type: 'sell', from: { area: 'board', index: 3 } }).ok).toBe(true);
    p.board[3] = { uid: 953, defId: 'dyroth', star: 1 }; // another of the same hero
    expect(playerTraitCounts(p)[trait]).toBe(1);
  });

  test('Eclipse on Lunox: 8 gold on the pick (his 6 came with Lunox already), and the first time the blessed trait reaches 6, 18 gold, once', () => {
    const { state, p } = lunoxGame('lunox');
    expect(p.gold).toBe(LUNOX.cardGold);
    expect(LUNOX.cardGold).toBe(8);
    expect(LUNOX.twilightGold.gold).toBe(18);
    const trait = 'gustiwana';
    p.board[0] = { uid: 960, defId: 'dyroth', star: 1 };
    p.twilight = { holder: 960, trait, gifts: [] };
    p.gold = 0;
    syncPlayer(state, p);
    expect(p.gold).toBe(0);
    const others = UNITS.filter((u) => u.id !== 'dyroth' && u.shop !== false && !u.piece && u.traits.includes(trait)).slice(0, 4);
    others.forEach((u, i) => (p.board[1 + i] = { uid: 961 + i, defId: u.id, star: 1 }));
    expect(playerTraitCounts(p)[trait]).toBeGreaterThanOrEqual(LUNOX.twilightGold.count);
    syncPlayer(state, p);
    expect(p.gold).toBe(LUNOX.twilightGold.gold);
    syncPlayer(state, p);
    expect(p.gold).toBe(LUNOX.twilightGold.gold);
  });

  test('on another commander: the blessing and 12 gold, no heroes', () => {
    const { state, p } = lunoxGame('lunox', 'lukas');
    expect(p.gold).toBe(LUNOX.other.gold);
    p.board[3] = { uid: 970, defId: 'dyroth', star: 1 };
    expect(applyAction(state, p.id, { type: 'bless', unit: 970 }).ok).toBe(true);
    expect(p.twilight!.gifts).toEqual([]);
    expect(powersOf(p).twilightGold).toBeUndefined();
  });
});

describe('Miya', () => {
  function miyaGame(): { state: GameState; p: Player; foe: Player } {
    const state = createGame(13, SEEDS);
    const [p, foe] = state.players;
    expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'miya' }).ok).toBe(true);
    expect(applyAction(state, foe.id, { type: 'pickCommander', commander: 'lukas' }).ok).toBe(true);
    for (const x of [p, foe]) {
      x.bench.fill(null);
      x.board.fill(null);
      x.items = [];
    }
    return { state, p, foe };
  }
  const archer = UNITS.find((u) => u.shop !== false && !u.piece && u.range > 1 && u.tier === 1)!;

  test('the Ice Arrow Blessing: a mark, moved freely, +50% attack speed', () => {
    const { state, p } = miyaGame();
    p.board[0] = { uid: 980, defId: archer.id, star: 1 };
    p.board[1] = { uid: 981, defId: archer.id, star: 1 };
    const levels = playerTraits(p);
    const base = fieldStats(p, levels, {}).get(980)!.attackSpeed;
    expect(applyAction(state, p.id, { type: 'mark', kind: 'iceArrow', unit: 980 }).ok).toBe(true);
    expect(fieldStats(p, levels, {}).get(980)!.attackSpeed - base).toBeCloseTo(MIYA.iceArrow.attackSpeed);
    expect(applyAction(state, p.id, { type: 'mark', kind: 'iceArrow', unit: 981 }).ok).toBe(true); // moved
    expect(fieldStats(p, levels, {}).get(980)!.attackSpeed).toBeCloseTo(base);
    expect(markedUid(p, 'iceArrow')).toBe(981);
  });

  test('every 6th basic attack looses ice arrows at up to 6 enemies, 7% of each one\'s max hp, physical', () => {
    const { state, p, foe } = miyaGame();
    p.board[3] = { uid: 982, defId: archer.id, star: 2 };
    p.board[2] = { uid: 983, defId: 'titan', star: 3 }; // keeps the archer alive
    for (let i = 0; i < 7; i++) foe.board[7 * 2 + i] = { uid: 990 + i, defId: 'titan', star: 1 };
    applyAction(state, p.id, { type: 'mark', kind: 'iceArrow', unit: 982 });
    const result = simulateCombat(state, p, foe, { chosen: state.chosen });
    const me = result.fighters.find((f) => f.side === 0 && f.defId === archer.id)!;
    const mine = result.events.filter((e) => (e.type === 'attack' && e.id === me.id) || (e.type === 'effect' && e.effect === 'icearrow' && e.by === me.id));
    const first = mine.findIndex((e) => e.type === 'effect');
    expect(first).toBeGreaterThan(0);
    expect(mine.slice(0, first).filter((e) => e.type === 'attack' && !(e as { again?: boolean }).again).length).toBeLessThanOrEqual(MIYA.iceArrow.every);
    // One volley: all its arrows on one tick, at most 6, each under 7% of the target's max hp (armor).
    const volleyT = mine[first].t;
    const volley = result.events.filter((e) => e.type === 'effect' && e.effect === 'icearrow' && e.t === volleyT);
    expect(volley.length).toBeGreaterThan(1);
    expect(volley.length).toBeLessThanOrEqual(MIYA.iceArrow.targets);
    for (const e of volley) {
      const target = result.fighters.find((f) => f.id === (e as { target: number }).target)!;
      expect((e as { damage: number }).damage).toBeLessThanOrEqual(Math.round(target.maxHp * MIYA.iceArrow.share * 1.5));
      expect((e as { damage: number }).damage).toBeGreaterThan(0);
    }
  });

  test('her card: 12 gold and the Ice Longbow; +30% attack speed, and a kill heals the lowest ally 20%', () => {
    const { state, p, foe } = miyaGame();
    p.gold = 0;
    p.cardOffer = ['miya'];
    expect(applyAction(state, p.id, { type: 'pickCard', card: 'miya' }).ok).toBe(true);
    expect(p.gold).toBe(MIYA.card.gold);
    const bow = p.items.find((i) => i.id === 'icelongbow')!;
    expect(bow).toBeDefined();
    expect(ITEMS.icelongbow.exclusive).toBe(true);
    expect(EQUIPMENT).not.toContain('icelongbow');
    p.board[3] = { uid: 984, defId: 'titan', star: 3 };
    p.board[2] = { uid: 985, defId: 'footman', star: 1 };
    const levels = playerTraits(p);
    const base = fieldStats(p, levels, {}).get(984)!.attackSpeed;
    bow.holder = 984;
    expect(fieldStats(p, levels, {}).get(984)!.attackSpeed - base).toBeCloseTo(ICE_LONGBOW.attackSpeed);
    foe.board[7 * 2 + 3] = { uid: 995, defId: 'footman', star: 1 };
    foe.board[7 * 2 + 4] = { uid: 996, defId: 'footman', star: 1 };
    const result = simulateCombat(state, p, foe, { chosen: state.chosen });
    const holder = result.fighters.find((f) => f.side === 0 && f.defId === 'titan')!;
    const heals = result.events.filter((e) => e.type === 'effect' && e.effect === 'frostmercy');
    expect(heals.length).toBeGreaterThan(0);
    for (const e of heals) expect((e as { by: number }).by).toBe(holder.id);
  });
});

describe('Alice', () => {
  const hero = UNITS.find((u) => u.tier === 1 && u.shop !== false && !u.piece)!;
  function aliceGame(): { state: GameState; p: Player } {
    const state = createGame(17, SEEDS);
    const p = state.players[0];
    expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'alice' }).ok).toBe(true);
    applyAction(state, state.players[1].id, { type: 'pickCommander', commander: 'lukas' });
    p.bench.fill(null);
    p.board.fill(null);
    return { state, p };
  }
  const buy = (state: GameState, p: Player, uid: number) => {
    const i = p.bench.findIndex((u) => u === null);
    p.bench[i] = { uid, defId: hero.id, star: 1 };
    state.pool[hero.id]--;
    mergeUnits(p, hero.id); // what a real buy does
  };

  test('a Blood Pact on I-1, II-1 and III-1; unused ones wait; one per hero type', () => {
    const { state, p } = aliceGame();
    expect(p.blood!.uses).toBe(1); // picked on I-1
    while (state.round < roundAt(3, 1)) startRound(state);
    expect(p.blood!.uses).toBe(3);
    p.board[0] = { uid: 1001, defId: hero.id, star: 1 };
    expect(applyAction(state, p.id, { type: 'bloodPact', unit: 1001 }).ok).toBe(true);
    expect(applyAction(state, p.id, { type: 'bloodPact', unit: 1001 }).ok).toBe(false); // already blessed
    expect(p.blood!.uses).toBe(2);
  });

  test('the Pact gives a copy at once; a 2-star (3 copies) becomes 4 copies: 2 stars and a part', () => {
    const { state, p } = aliceGame();
    p.board[0] = { uid: 1002, defId: hero.id, star: 2 };
    expect(applyAction(state, p.id, { type: 'bloodPact', unit: 1002 }).ok).toBe(true);
    const u = p.board[0]!;
    expect(u.copies).toBe(4);
    expect(u.star).toBe(2);
    expect(bloodStars(4)).toEqual({ full: 2, frac: 1 / 6 });
    expect(copiesOf(u)).toBe(4);
  });

  test('copies pile into one hero: 3 = 2 stars, 9 = 3 stars, 13 = 4 red stars and the cap', () => {
    const { state, p } = aliceGame();
    p.board[0] = { uid: 1003, defId: hero.id, star: 1 };
    applyAction(state, p.id, { type: 'bloodPact', unit: 1003 }); // 2 copies
    const u = p.board[0]!;
    expect(u.copies).toBe(2);
    expect(u.star).toBe(1);
    let uid = 1100;
    buy(state, p, uid++);
    expect(u.copies).toBe(3);
    expect(u.star).toBe(2);
    while (u.copies! < 9) buy(state, p, uid++);
    expect(u.star).toBe(3);
    while (u.copies! < 13) buy(state, p, uid++);
    expect(bloodStars(13)).toEqual({ full: 4, frac: 0 });
    expect(p.bench.filter(Boolean)).toHaveLength(0); // all absorbed
    buy(state, p, uid++); // past the cap: stays a separate copy
    expect(u.copies).toBe(13);
    expect(p.bench.filter(Boolean)).toHaveLength(1);
  });

  test('a full bench still buys a copy of a blessed hero: it goes straight in', () => {
    const { state, p } = aliceGame();
    p.board[0] = { uid: 1005, defId: hero.id, star: 1 };
    applyAction(state, p.id, { type: 'bloodPact', unit: 1005 });
    const other = UNITS.find((u) => u.id !== hero.id && u.shop !== false && !u.piece)!;
    for (let i = 0; i < p.bench.length; i++) p.bench[i] = { uid: 1200 + i, defId: other.id, star: 1 };
    p.shop[0] = hero.id;
    p.gold = 10;
    state.pool[hero.id]--;
    expect(applyAction(state, p.id, { type: 'buy', slot: 0 }).ok).toBe(true);
    expect(p.board[0]!.copies).toBe(3);
    expect(p.board[0]!.star).toBe(2);
  });

  test('stats: every copy counts; past 3 stars +10% attack, magic attack and hp each; the card adds +40% attack', () => {
    const { state, p } = aliceGame();
    p.board[0] = { uid: 1004, defId: hero.id, star: 1 };
    applyAction(state, p.id, { type: 'bloodPact', unit: 1004 });
    const u = p.board[0]!;
    const levels = playerTraits(p);
    const base1 = unitStats(hero, 1, { levels });
    // 2 copies: halfway from 1 star to 2 stars.
    const s2 = fieldStats(p, playerTraits(p), {}).get(1004)!;
    expect(s2.hp / base1.hp).toBeCloseTo(1 + (STAR_MULT[1] / STAR_MULT[0] - 1) * 0.5, 1);
    u.copies = 11;
    u.star = 3;
    const base3 = unitStats(hero, 3, { levels: playerTraits(p) });
    const s11 = fieldStats(p, playerTraits(p), {}).get(1004)!;
    expect(s11.hp / base3.hp).toBeCloseTo(1 + 2 * ALICE.bloodPact.perCopy, 1);
    p.commanderCard = 'alice';
    const s11c = fieldStats(p, playerTraits(p), {}).get(1004)!;
    expect(s11c.atk / base3.atk).toBeCloseTo(1 + 2 * ALICE.bloodPact.perCopy + ALICE.card.hybridAtk, 1);
  });

  test('her card: +10 XP on the pick', () => {
    const { state, p } = aliceGame();
    p.level = 5;
    p.xp = 0;
    p.cardOffer = ['alice'];
    expect(applyAction(state, p.id, { type: 'pickCard', card: 'alice' }).ok).toBe(true);
    expect(p.xp).toBe(ALICE.card.xp);
  });
});

describe('Johnson', () => {
  function johnsonGame(): { state: GameState; p: Player } {
    const state = createGame(2, SEEDS);
    for (const p of state.players) expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'johnson' }).ok).toBe(true);
    return { state, p: state.players[0] };
  }

  test("picking him opens Johnnie's Den: Johnnies with all different factions and all different roles", () => {
    const { p } = johnsonGame();
    const offer = p.johnnie!.offer;
    expect(offer.length).toBe(JOHNSON.johnnie.offer);
    expect(p.johnnie!.defId).toBeNull();
    for (const k of [0, 1]) expect(new Set(offer.map((id) => UNIT_BY_ID[id].traits[k])).size).toBe(offer.length);
    expect(offer.every((id) => UNIT_BY_ID[id].johnnie)).toBe(true);
  });

  test('the Johnnie picked comes free, then rolls in the shop at 0 gold and sells for nothing', () => {
    const { state, p } = johnsonGame();
    const id = p.johnnie!.offer[2];
    const gold = p.gold;
    expect(applyAction(state, p.id, { type: 'pickJohnnie', johnnie: id }).ok).toBe(true);
    expect(p.johnnie).toEqual({ offer: [], defId: id });
    expect(p.bench.filter((u) => u?.defId === id).length).toBe(1);
    expect(p.gold).toBe(gold);
    expect(applyAction(state, p.id, { type: 'pickJohnnie', johnnie: id }).ok).toBe(false); // once
    expect(id in state.pool).toBe(false);
    // It turns up like a 3-gold hero; the other player never sees it.
    p.level = 7;
    state.players[1].level = 7;
    let slot = -1;
    let seenByOther = false;
    for (let i = 0; i < 200 && slot < 0; i++) {
      refreshShop(state, p);
      refreshShop(state, state.players[1]);
      slot = p.shop.indexOf(id);
      seenByOther ||= state.players[1].shop.includes(id);
    }
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(seenByOther).toBe(false);
    const before = p.gold;
    expect(applyAction(state, p.id, { type: 'buy', slot }).ok).toBe(true);
    expect(p.gold).toBe(before);
    const at = p.bench.findIndex((u) => u?.defId === id);
    expect(applyAction(state, p.id, { type: 'sell', from: { area: 'bench', index: at } }).ok).toBe(true);
    expect(p.gold).toBe(before);
    expect(id in state.pool).toBe(false);
  });

  test('picked with a full bench, the Johnnie waits for room', () => {
    const { state, p } = johnsonGame();
    p.bench.fill(null);
    p.bench.forEach((_, i) => (p.bench[i] = { uid: 900 + i, defId: 'cici', star: 1 }));
    const id = p.johnnie!.offer[0];
    expect(applyAction(state, p.id, { type: 'pickJohnnie', johnnie: id }).ok).toBe(true);
    expect(p.gifts).toContain(id);
    p.bench[0] = null;
    syncPlayer(state, p);
    expect(p.bench.some((u) => u?.defId === id)).toBe(true);
  });

  test('Family Business: every Johnnie gets +35% attack and magic attack and +30% HP, other heroes nothing', () => {
    const { p } = johnsonGame();
    const id = p.johnnie!.offer[0];
    p.board.fill(null);
    p.board[0] = { uid: 700, defId: id, star: 1 };
    p.board[1] = { uid: 701, defId: 'cici', star: 1 };
    const stats = () => fieldStats(p, playerTraits(p));
    const before = stats();
    p.commanderCard = 'johnson';
    const after = stats();
    const j0 = before.get(700)!;
    const j1 = after.get(700)!;
    expect(j1.atk).toBeCloseTo(j0.atk * (1 + JOHNSON.card.hybridAtk), -1);
    expect(j1.ap).toBeCloseTo(j0.ap * (1 + JOHNSON.card.hybridAtk), -1);
    expect(j1.hp).toBeCloseTo(j0.hp * (1 + JOHNSON.card.hp), -1);
    expect(after.get(701)).toEqual(before.get(701));
  });

  test("on another commander, his card opens Johnnie's Den", () => {
    const { state, p } = johnsonGame();
    p.commander = 'lukas';
    p.johnnie = undefined;
    syncPlayer(state, p);
    expect(p.johnnie).toBeUndefined();
    p.commanderCard = 'johnson';
    syncPlayer(state, p);
    expect(p.johnnie!.offer.length).toBe(JOHNSON.johnnie.offer);
  });
});

describe('Amon', () => {
  function amonGame(): { state: GameState; p: Player } {
    const state = createGame(2, SEEDS);
    for (const p of state.players) expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'amon' }).ok).toBe(true);
    return { state, p: state.players[0] };
  }
  // Takes a fresh hero to 2 stars: three 1-star copies on the bench, merged.
  let nextUid = 5000;
  function twoStar(state: GameState, p: Player, defId: string): void {
    p.bench.fill(null);
    for (let i = 0; i < 3; i++) p.bench[i] = { uid: nextUid++, defId, star: 1 };
    mergeUnits(p, defId);
    syncPlayer(state, p);
  }
  const heroes = UNITS.filter((u) => u.tier === 1 && u.shop !== false).map((u) => u.id);

  test('starts with a Mirror Device; every 7 heroes to 2 stars make another and pay 12 gold, 2 times at most', () => {
    const { state, p } = amonGame();
    expect(p.mirrors).toBe(AMON.mirrorBar.start);
    const gold = p.gold;
    for (let i = 0; i < AMON.mirrorBar.steps - 1; i++) twoStar(state, p, heroes[i % heroes.length]);
    expect(p.mirrorBar).toEqual({ steps: AMON.mirrorBar.steps - 1, made: 0 });
    expect(p.mirrors).toBe(1);
    twoStar(state, p, heroes[0]);
    expect(p.mirrorBar).toEqual({ steps: 0, made: 1 });
    expect(p.mirrors).toBe(2);
    expect(p.gold - gold).toBe(AMON.mirrorBar.gold);
    for (let i = 0; i < AMON.mirrorBar.steps * 2; i++) twoStar(state, p, heroes[i % heroes.length]);
    expect(p.mirrorBar!.made).toBe(AMON.mirrorBar.max);
    expect(p.mirrors).toBe(AMON.mirrorBar.start + AMON.mirrorBar.max);
    expect(p.gold - gold).toBe(AMON.mirrorBar.gold * AMON.mirrorBar.max);
  });

  test('a 3-star merge is no step; picking him again gives no second starting device', () => {
    const { state, p } = amonGame();
    p.bench.fill(null);
    for (let i = 0; i < 3; i++) p.bench[i] = { uid: nextUid++, defId: heroes[0], star: 2 };
    mergeUnits(p, heroes[0]);
    syncPlayer(state, p);
    expect(p.mirrorBar!.steps).toBe(0);
    syncPlayer(state, p);
    expect(p.mirrors).toBe(1);
  });

  test('Polished Reflection: 4 gold per hero to 2 stars, up to 32', () => {
    const { state, p } = amonGame();
    p.commanderCard = 'amon';
    p.mirrorBar!.made = AMON.mirrorBar.max; // the bar's gold out of the way
    const gold = p.gold;
    twoStar(state, p, heroes[0]);
    expect(p.gold - gold).toBe(AMON.starGold.gold);
    for (let i = 0; i < 12; i++) twoStar(state, p, heroes[i % heroes.length]);
    expect(p.gold - gold).toBe(AMON.starGold.max);
    expect(p.starGold).toBe(AMON.starGold.max);
  });

  test('on another commander, his card is just 1 Mirror Device: no bar, no gold per 2 stars', () => {
    const { state, p } = amonGame();
    p.commander = 'lukas';
    p.mirrorBar = undefined;
    p.mirrors = 0;
    p.cardOffer = ['amon'];
    expect(applyAction(state, p.id, { type: 'pickCard', card: 'amon' }).ok).toBe(true);
    expect(p.mirrors).toBe(AMON.otherMirrors);
    expect(p.mirrorBar).toBeUndefined();
    expect(powersOf(p).mirrorBar).toBeUndefined();
    expect(powersOf(p).starGold).toBeUndefined();
    syncPlayer(state, p);
    expect(p.mirrors).toBe(AMON.otherMirrors); // once, on the pick
  });
});

describe('Freya', () => {
  function freyaGame(): { state: GameState; p: Player } {
    const state = createGame(2, SEEDS);
    for (const p of state.players) expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'freya' }).ok).toBe(true);
    const p = state.players[0];
    p.board.fill(null);
    p.bench.fill(null);
    return { state, p };
  }
  // `n` different Mages on the board (plus a non-Mage), so Mage is active.
  function fieldMages(p: Player, n: number): void {
    const mages = UNITS.filter((u) => u.shop !== false && !u.locked && u.traits.includes('mage')).slice(0, n);
    mages.forEach((u, i) => (p.board[i] = { uid: 800 + i, defId: u.id, star: 1 }));
    p.level = 9;
  }

  test('blessing a role adds its extra on top, any time, to the right units; other roles refused', () => {
    const { state, p } = freyaGame();
    fieldMages(p, 2);
    const other = UNITS.find((u) => u.shop !== false && !u.traits.includes('mage'))!;
    p.board[7] = { uid: 899, defId: other.id, star: 1 };
    const ap = () => fieldStats(p, playerTraits(p)).get(899)!.ap;
    const before = ap();
    expect(applyAction(state, p.id, { type: 'enhance', trait: 'mage' }).ok).toBe(true);
    // Mage blesses every ally: +10% magic attack at 2 on top of the trait's own +10%.
    expect(ap()).toBeCloseTo(before * (1 + 0.1 + FREYA.enhance.traits.mage.mods[0].pct![0]) / 1.1);
    expect(applyAction(state, p.id, { type: 'enhance', trait: 'fighter' }).ok).toBe(true);
    expect(ap()).toBeCloseTo(before);
    expect(applyAction(state, p.id, { type: 'enhance', trait: 'astral' }).ok).toBe(false);
    expect(applyAction(state, p.id, { type: 'enhance', trait: 'weaponmaster' }).ok).toBe(false);
  });

  test('Fighter blesses only Fighters', () => {
    const { state, p } = freyaGame();
    const fighters = UNITS.filter((u) => u.shop !== false && !u.locked && u.traits.includes('fighter')).slice(0, 2);
    fighters.forEach((u, i) => (p.board[i] = { uid: 810 + i, defId: u.id, star: 1 }));
    const other = UNITS.find((u) => u.shop !== false && !u.traits.includes('fighter'))!;
    p.board[7] = { uid: 899, defId: other.id, star: 1 };
    const amp = (uid: number) => fieldStats(p, playerTraits(p)).get(uid)!.basicAmp;
    const [f0, o0] = [amp(810), amp(899)];
    applyAction(state, p.id, { type: 'enhance', trait: 'fighter' });
    expect(amp(810) - f0).toBeCloseTo(0.05);
    expect(amp(899)).toBe(o0);
  });

  test('rewards wait for the player, once each: 2 heroes of the role worth 4 gold at 2', () => {
    const { state, p } = freyaGame();
    applyAction(state, p.id, { type: 'enhance', trait: 'mage' });
    expect(claimable(p)).toEqual([]);
    fieldMages(p, 2);
    expect(claimable(p)).toEqual([1]);
    expect(p.bench.every((u) => u === null)).toBe(true); // never on its own
    const pool = { ...state.pool };
    expect(applyAction(state, p.id, { type: 'claimEnhance', level: 1 }).ok).toBe(true);
    // What left the pool (the copies may merge with the Mages on the board, so count from there).
    const got = Object.keys(pool).flatMap((id) => Array(pool[id] - state.pool[id]).fill(UNIT_BY_ID[id]) as (typeof UNITS)[number][]);
    expect(got.length).toBe(2);
    expect(got.every((u) => u.traits.includes('mage'))).toBe(true);
    expect(got.reduce((n, u) => n + u.tier, 0)).toBe(FREYA.enhance.rewardGold[0]);
    expect(p.gifts ?? []).toEqual([]); // both delivered
    expect(applyAction(state, p.id, { type: 'claimEnhance', level: 1 }).ok).toBe(false);
    // Switching roles doesn't open the same reward again.
    applyAction(state, p.id, { type: 'enhance', trait: 'fighter' });
    expect(claimable(p)).toEqual([]);
    expect(applyAction(state, p.id, { type: 'claimEnhance', level: 2 }).ok).toBe(false); // not reached
  });

  test('Harvest Blessing: 10 gold at 2, an Equipment Chest at 4, an orb at 6', () => {
    const { state, p } = freyaGame();
    p.commanderCard = 'freya';
    applyAction(state, p.id, { type: 'enhance', trait: 'mage' });
    fieldMages(p, 6);
    expect(claimable(p)).toEqual([1, 2, 3]);
    const gold = p.gold;
    applyAction(state, p.id, { type: 'claimEnhance', level: 1 });
    expect(p.gold - gold).toBe(FREYA.cardGold);
    applyAction(state, p.id, { type: 'claimEnhance', level: 2 });
    expect(p.offerFrom).toBe('chest');
    const orbs = p.mistOrbs?.length ?? 0;
    applyAction(state, p.id, { type: 'claimEnhance', level: 3 });
    expect(p.mistOrbs!.length).toBe(orbs + 1);
    expect(p.freya!.claimed).toEqual([1, 2, 3]);
  });
});

describe('Cyclops', () => {
  const SEATS = [0, 1, 2].map((i) => ({ id: `p${i}`, name: `P${i}`, isBot: false }));
  function cyclopsGame(): { state: GameState; p: Player; a: Player; b: Player } {
    const state = createGame(4, SEATS);
    const [p, a, b] = state.players;
    expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'cyclops' }).ok).toBe(true);
    for (const o of [a, b]) applyAction(state, o.id, { type: 'pickCommander', commander: 'lukas' });
    for (const o of state.players) {
      o.board.fill(null);
      o.bench.fill(null);
    }
    return { state, p, a, b };
  }
  // Two Mages and an Astral on the board: Mage is the biggest trait.
  function fieldMages(p: Player): void {
    const mages = UNITS.filter((u) => u.shop !== false && !u.locked && u.traits.includes('mage') && !u.traits.includes('astral')).slice(0, 2);
    mages.forEach((u, i) => (p.board[i] = { uid: 600 + i, defId: u.id, star: 1 }));
    p.board[5] = { uid: 610, defId: 'minos', star: 1 };
  }

  test('dropping to 80 HP or below, once: 3 heroes of the biggest trait and an Equipment Chest', () => {
    const { state, p } = cyclopsGame();
    fieldMages(p);
    p.level = 6;
    p.hp = CYCLOPS.rally.hp + 1;
    checkRally(state, p);
    expect(p.rallied).toBeUndefined();
    p.hp = CYCLOPS.rally.hp;
    checkRally(state, p);
    expect(p.rallied!.trait).toBe('mage');
    expect(p.rallied!.heroes).toHaveLength(CYCLOPS.rally.heroes);
    expect(p.rallied!.heroes.every((id) => UNIT_BY_ID[id].traits.includes('mage'))).toBe(true);
    expect(p.gifts).toEqual(p.rallied!.heroes); // delivered as bench room allows
    expect(p.chests!.waiting).toBe(CYCLOPS.rally.chests);
    p.hp = 10;
    checkRally(state, p);
    expect(p.gifts).toHaveLength(CYCLOPS.rally.heroes); // never again
  });

  test('a knockout pays 14% of their hero value (every copy, board and bench); the card adds 15% and 12 gold, on anyone', () => {
    const { state, p, a, b } = cyclopsGame();
    a.board[0] = { uid: 700, defId: 'fanny', star: 2 }; // 5 gold x 3 copies
    a.bench[0] = { uid: 701, defId: 'cici', star: 1 }; // 1 gold
    expect(heroValue(a)).toBe(16);
    const gold = p.gold;
    const bGold = b.gold;
    payHeirs(state, a);
    expect(p.gold - gold).toBe(Math.round(16 * CYCLOPS.heirShare));
    expect(p.heirGold).toBe(Math.round(16 * CYCLOPS.heirShare));
    expect(b.gold).toBe(bGold); // Lukas gets nothing
    // A real knockout pays through the fight round.
    a.hp = -5;
    resolveCombat(state);
    expect(a.place).not.toBeNull();
    expect(p.heirGold).toBe(2 * Math.round(16 * CYCLOPS.heirShare));
    // The card, on Cyclops: 12 gold now, and 29% in all.
    p.cardOffer = ['cyclops'];
    const before = p.gold;
    applyAction(state, p.id, { type: 'pickCard', card: 'cyclops' });
    expect(p.gold - before).toBe(CYCLOPS.card.gold);
    expect(powersOf(p).heirShare! + powersOf(p).heirShareCard!).toBeCloseTo(0.29);
    // On another commander: the same card face.
    b.cardOffer = ['cyclops'];
    applyAction(state, b.id, { type: 'pickCard', card: 'cyclops' });
    expect(powersOf(b).heirShareCard).toBe(CYCLOPS.card.heirShare);
    expect(powersOf(b).heirShare).toBeUndefined();
  });
});

describe('Guiness', () => {
  function guinessGame(): { state: GameState; p: Player } {
    const state = createGame(6, SEEDS);
    for (const p of state.players) expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'guiness' }).ok).toBe(true);
    const p = state.players[0];
    p.level = 5;
    return { state, p };
  }

  test('starts with an Equipment Chest, opened at once', () => {
    const { p } = guinessGame();
    expect(p.offerFrom).toBe('chest');
    expect(p.itemOffer).toHaveLength(3);
  });

  test('after a free refresh, a hero in the shop is free about 24% of the time; buying it costs nothing', () => {
    const { state, p } = guinessGame();
    let free = 0;
    for (let i = 0; i < 500; i++) {
      refreshShop(state, p);
      expect(p.freeSlot).toBeNull(); // a refresh clears it
      rollFreeHero(state, p);
      if (p.freeSlot != null) free++;
    }
    expect(free / 500).toBeGreaterThan(GUINESS.freeHeroChance - 0.06);
    expect(free / 500).toBeLessThan(GUINESS.freeHeroChance + 0.06);
    // Buy the free one.
    while (p.freeSlot == null) {
      refreshShop(state, p);
      rollFreeHero(state, p);
    }
    const slot = p.freeSlot!;
    expect(shopPrice(p, slot)).toBe(0);
    p.bench.fill(null);
    p.gold = 0;
    expect(applyAction(state, p.id, { type: 'buy', slot }).ok).toBe(true);
    expect(p.gold).toBe(0);
    expect(p.freeSlot).toBeNull();
  });

  test('the round-start refresh rolls it, but never on round 1 and never for a locked shop', () => {
    const { state, p } = guinessGame();
    p.freeHeroes = 99; // the card's guarantee, so every roll lands
    for (const o of state.players) o.commanderCard = 'nana'; // no card round offer in the way
    resolveCombat(state);
    startRound(state);
    expect(p.freeSlot).not.toBeNull();
    p.shopLocked = true;
    const left = p.freeHeroes;
    resolveCombat(state);
    startRound(state);
    expect(p.freeHeroes).toBe(left); // the locked shop wasn't refreshed, so nothing rolled
  });

  test('On the House: a free hero in each of the next 15 after-fight shops, then back to the chance', () => {
    const { state, p } = guinessGame();
    p.cardOffer = ['guiness'];
    applyAction(state, p.id, { type: 'pickCard', card: 'guiness' });
    expect(p.freeHeroes).toBe(GUINESS.card.rounds);
    for (let i = 0; i < GUINESS.card.rounds; i++) {
      refreshShop(state, p);
      rollFreeHero(state, p);
      expect(p.freeSlot).not.toBeNull();
    }
    expect(p.freeHeroes).toBe(0);
    let misses = 0;
    for (let i = 0; i < 50; i++) {
      refreshShop(state, p);
      rollFreeHero(state, p);
      if (p.freeSlot == null) misses++;
    }
    expect(misses).toBeGreaterThan(0);
  });

  test("on another commander, his card lends the innate: the chance, and a chest on the pick", () => {
    const { state } = guinessGame();
    const o = state.players[1];
    o.commander = 'lukas';
    o.itemOffer = undefined;
    o.chests = undefined;
    o.cardOffer = ['guiness'];
    applyAction(state, o.id, { type: 'pickCard', card: 'guiness' });
    expect(powersOf(o).freeHeroChance).toBe(GUINESS.freeHeroChance);
    expect(o.freeHeroes ?? 0).toBe(0);
    expect(o.offerFrom).toBe('chest');
  });
});
