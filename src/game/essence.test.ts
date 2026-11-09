import { describe, expect, test } from 'bun:test';
import { applyAction } from './actions';
import { LUO_YI } from './commanders';
import { coreHolder, essenceCore, essenceMods, ESSENCE_ROLES } from './essence';
import { createGame, startRound } from './game';
import { fieldStats } from './inventory';
import { ESSENCE_CORE, ITEMS } from './items';
import { baseStats } from './stats';
import { syncPlayer } from './sync';
import { playerTraitCounts, playerTraits } from './traits';
import type { GameState, Player } from './types';
import { UNIT_BY_ID, UNITS } from './units';

const SEEDS = [
  { id: 'you', name: 'You', isBot: false },
  { id: 'b', name: 'B', isBot: false },
];

function luoGame(): { state: GameState; p: Player } {
  const state = createGame(23, SEEDS);
  const p = state.players[0];
  expect(applyAction(state, p.id, { type: 'pickCommander', commander: 'luoyi' }).ok).toBe(true);
  applyAction(state, state.players[1].id, { type: 'pickCommander', commander: 'lukas' });
  p.bench.fill(null);
  p.board.fill(null);
  p.items = [];
  return { state, p };
}
const withRoles = (...roles: string[]) => UNITS.find((u) => u.shop !== false && !u.piece && roles.every((r) => u.traits.includes(r)))!;

describe('Luo Yi: Essence Altar', () => {
  test('a hero on the altar leaves the board, stops counting toward traits, and the core appears', () => {
    const { state, p } = luoGame();
    const mage = withRoles('mage');
    p.board[0] = { uid: 900, defId: mage.id, star: 1 };
    expect(playerTraitCounts(p).mage).toBe(1);
    expect(applyAction(state, p.id, { type: 'essenceIn', unit: 900 }).ok).toBe(true);
    expect(p.board[0]).toBeNull();
    expect(p.essence!.hero!.uid).toBe(900);
    expect(playerTraitCounts(p).mage ?? 0).toBe(0);
    expect(essenceCore(p)).not.toBeNull();
  });

  test('the holder gets 40% of the hero\'s stats and items, plus its role effect', () => {
    const { state, p } = luoGame();
    const mage = withRoles('mage');
    const holder = UNITS.find((u) => u.id !== mage.id && u.shop !== false && !u.piece)!;
    p.bench[0] = { uid: 900, defId: mage.id, star: 2 };
    const sword = Object.values(ITEMS).find((d) => !d.trait && !d.exclusive && d.mods(1).length > 0)!;
    p.items.push({ uid: 950, id: sword.id, tier: 1, holder: 900 });
    applyAction(state, p.id, { type: 'essenceIn', unit: 900 });
    expect(p.items.some((i) => i.uid === 950)).toBe(false); // locked in the core
    p.board[3] = { uid: 901, defId: holder.id, star: 1 };
    const before = fieldStats(p, playerTraits(p)).get(901)!;
    applyAction(state, p.id, { type: 'equip', item: essenceCore(p)!.uid, unit: 901 });
    expect(coreHolder(p)?.uid).toBe(901);
    const after = fieldStats(p, playerTraits(p)).get(901)!;
    const s = baseStats(mage, 2);
    // HP: the share, and the core's own +10% max HP on top.
    expect(after.hp).toBeGreaterThan(before.hp + s.hp * LUO_YI.essence.share);
    expect(after.armor).toBeCloseTo(before.armor + s.armor * LUO_YI.essence.share, -0.5);
    const m = sword.mods(1)[0];
    const share = LUO_YI.essence.share;
    // Mage: +25% magic attack on top of the flat share.
    expect(after.ap).toBeGreaterThan(before.ap + s.ap * LUO_YI.essence.share);
    expect(essenceMods(p)).toContainEqual({ stat: m.stat, ...(m.add !== undefined ? { add: m.add * share } : {}), ...(m.pct !== undefined ? { pct: m.pct * share } : {}) });
  });

  test('swapping puts the old hero (and its items) where the new one was; taking out removes the core', () => {
    const { state, p } = luoGame();
    const [a, b] = UNITS.filter((u) => u.shop !== false && !u.piece);
    p.bench[0] = { uid: 900, defId: a.id, star: 1 };
    p.bench[1] = { uid: 901, defId: b.id, star: 1 };
    p.items.push({ uid: 950, id: Object.values(ITEMS).find((d) => !d.trait && !d.exclusive)!.id, tier: 1, holder: 900 });
    applyAction(state, p.id, { type: 'essenceIn', unit: 900 });
    applyAction(state, p.id, { type: 'essenceIn', unit: 901 });
    expect(p.bench[1]!.uid).toBe(900);
    expect(p.items.find((i) => i.uid === 950)!.holder).toBe(900);
    expect(p.essence!.hero!.uid).toBe(901);
    expect(p.items.filter((i) => i.id === ESSENCE_CORE)).toHaveLength(1);
    expect(applyAction(state, p.id, { type: 'essenceOut' }).ok).toBe(true);
    expect(p.bench.some((u) => u?.uid === 901)).toBe(true);
    expect(essenceCore(p)).toBeNull();
  });

  test('taken out (or swapped back), the hero combines with copies bought while it was on the altar', () => {
    const { state, p } = luoGame();
    const [a, b] = UNITS.filter((u) => u.shop !== false && !u.piece);
    p.bench[0] = { uid: 900, defId: a.id, star: 1 };
    applyAction(state, p.id, { type: 'essenceIn', unit: 900 });
    p.bench[1] = { uid: 901, defId: a.id, star: 1 };
    p.bench[2] = { uid: 902, defId: a.id, star: 1 };
    expect(applyAction(state, p.id, { type: 'essenceOut' }).ok).toBe(true);
    const copies = p.bench.filter((u) => u?.defId === a.id);
    expect(copies).toHaveLength(1);
    expect(copies[0]!.star).toBe(2);

    // Same when another hero swaps it out.
    p.bench.fill(null);
    p.bench[0] = { uid: 910, defId: b.id, star: 1 };
    applyAction(state, p.id, { type: 'essenceIn', unit: 910 });
    p.bench[1] = { uid: 911, defId: b.id, star: 1 };
    p.bench[2] = { uid: 912, defId: b.id, star: 1 };
    p.bench[3] = { uid: 913, defId: a.id, star: 1 };
    applyAction(state, p.id, { type: 'essenceIn', unit: 913 });
    const bs = [...p.board, ...p.bench].filter((u) => u?.defId === b.id);
    expect(bs).toHaveLength(1);
    expect(bs[0]!.star).toBe(2);
  });

  test('the core can\'t lock itself in: putting its holder on the altar takes it off first', () => {
    const { state, p } = luoGame();
    const [a, b] = UNITS.filter((u) => u.shop !== false && !u.piece);
    p.bench[0] = { uid: 900, defId: a.id, star: 1 };
    p.bench[1] = { uid: 901, defId: b.id, star: 1 };
    applyAction(state, p.id, { type: 'essenceIn', unit: 900 });
    applyAction(state, p.id, { type: 'equip', item: essenceCore(p)!.uid, unit: 901 });
    applyAction(state, p.id, { type: 'essenceIn', unit: 901 });
    expect(essenceCore(p)!.holder).toBeNull();
    expect(p.essence!.items.some((i) => i.id === ESSENCE_CORE)).toBe(false);
  });

  test('a Phasewarper essence gives its holder the warp trigger in combat', async () => {
    const { state, p } = luoGame();
    const pw = withRoles('phasewarper');
    const other = UNITS.find((u) => u.shop !== false && !u.piece && !u.traits.includes('phasewarper'))!;
    p.bench[0] = { uid: 900, defId: pw.id, star: 1 };
    applyAction(state, p.id, { type: 'essenceIn', unit: 900 });
    p.board[3] = { uid: 901, defId: other.id, star: 1 };
    applyAction(state, p.id, { type: 'equip', item: essenceCore(p)!.uid, unit: 901 });
    const { essenceTriggers } = await import('./essence');
    expect(essenceTriggers(p, 901)).toEqual([{ trait: 'phasewarper', trigger: ESSENCE_ROLES.phasewarper.trigger! }]);
  });

  test('a Scavenger essence takes the cheapest shop hero every two rounds while the core is held', () => {
    const { state, p } = luoGame();
    const scav = withRoles('scavenger');
    const other = UNITS.find((u) => u.shop !== false && !u.piece && !u.traits.includes('scavenger'))!;
    p.bench[0] = { uid: 900, defId: scav.id, star: 1 };
    applyAction(state, p.id, { type: 'essenceIn', unit: 900 });
    p.board[3] = { uid: 901, defId: other.id, star: 1 };
    applyAction(state, p.id, { type: 'equip', item: essenceCore(p)!.uid, unit: 901 });
    const benchCount = () => p.bench.filter((u) => u).length;
    let free = 0;
    for (let i = 0; i < 4; i++) {
      p.gold = 0;
      const before = benchCount();
      startRound(state);
      syncPlayer(state, p);
      free += benchCount() - before;
      p.bench.fill(null);
    }
    expect(free).toBe(2);
  });
});

describe('Luo Yi card: Earthen Echo', () => {
  test('a random 3-cost hero now, then the same one each round until 6', () => {
    const { state, p } = luoGame();
    p.cardOffer = ['luoyi'];
    applyAction(state, p.id, { type: 'pickCard', card: 'luoyi' });
    const id = p.echo!.defId;
    expect(UNIT_BY_ID[id].tier).toBe(3);
    const owned = () => [...p.board, ...p.bench].filter((u) => u?.defId === id).reduce((n, u) => n + 3 ** (u!.star - 1), 0) + (p.gifts ?? []).filter((g) => g === id).length;
    syncPlayer(state, p);
    for (let i = 0; i < 8; i++) {
      startRound(state);
      syncPlayer(state, p);
      p.items = p.items.filter((it) => it.holder !== null);
    }
    expect(p.echo!.given).toBe(LUO_YI.echo.total);
    expect(owned()).toBe(LUO_YI.echo.total);
  });
});

describe('Essence Core: its own stats', () => {
  test('+10% attack, magic attack and max hp (Duality Transformation on top); enhanced +20%', () => {
    expect(ITEMS.essencecore.mods(1)).toEqual([{ stat: 'atk', pct: 0.1 }, { stat: 'ap', pct: 0.1 }, { stat: 'hp', pct: 0.1 }]);
    expect(ITEMS['essencecore+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.2 }, { stat: 'ap', pct: 0.2 }, { stat: 'hp', pct: 0.2 }]);
    expect(ITEMS.essencecore.desc).toContain('Duality Transformation');
  });

  test('an enhanced core still counts as the core: found, and taken away with the hero', () => {
    const { state, p } = luoGame();
    const hero = UNITS.find((u) => u.shop !== false && !u.piece)!;
    p.bench[0] = { uid: 900, defId: hero.id, star: 1 };
    applyAction(state, p.id, { type: 'essenceIn', unit: 900 });
    essenceCore(p)!.id = 'essencecore+';
    expect(essenceCore(p)?.id).toBe('essencecore+');
    applyAction(state, p.id, { type: 'essenceOut' });
    expect(p.items.some((i) => i.id.startsWith('essencecore'))).toBe(false);
  });
});
