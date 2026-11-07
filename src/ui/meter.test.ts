import { describe, expect, test } from 'bun:test';
import { createGame, resolveCombat } from '../game/game';
import { createMeter, meterHtml, recordEvent } from './meter';

describe('damage meter', () => {
  test("tallies exactly the viewer's own damage from the fight log", () => {
    const state = createGame(5, [
      { id: 'you', name: 'You', isBot: true },
      { id: 'foe', name: 'Foe', isBot: true },
    ]);
    // A few rounds in, so both bots have real boards.
    for (let i = 0; i < 6; i++) resolveCombat(state);
    const fight = resolveCombat(state)[0];
    const viewer = fight.home;
    const m = createMeter(fight, viewer);
    for (const e of fight.result.events) recordEvent(m, e);

    const side = fight.home === viewer ? 0 : 1;
    const mine = (id: number) => fight.result.fighters[id].side === side;
    const expected = fight.result.events.reduce((n, e) => {
      if ((e.type === 'attack' || e.type === 'cast') && mine(e.id)) return n + e.damage;
      if (e.type === 'effect' && !mine(e.target)) return n + e.damage;
      return n;
    }, 0);
    const tallied =
      [...m.byUnit.values()].reduce((n, d) => n + d.attack + d.skill, 0) + [...m.byTrait.values()].reduce((n, d) => n + d, 0);
    expect(tallied).toBe(expected);
    // Only the viewer's units are listed.
    expect([...m.byUnit.keys()].every(mine)).toBe(true);
    expect(meterHtml(m)).toContain(String(expected));

    // Damage taken: everything that landed on the viewer's units.
    const takenExpected = fight.result.events.reduce(
      (n, e) => ((e.type === 'attack' || e.type === 'cast' || e.type === 'effect') && fight.result.fighters[e.target] && mine(e.target) ? n + e.damage : n),
      0,
    );
    expect([...m.taken.values()].reduce((n, d) => n + d.attack + d.skill, 0)).toBe(takenExpected);
    expect(meterHtml(m, 'taken')).toContain(String(takenExpected));
    // Healing done: every heal credited to the viewer's units.
    const healExpected = fight.result.events.reduce(
      (n, e) => (e.type === 'heal' && fight.result.fighters[e.by ?? e.id] && mine(e.by ?? e.id) ? n + e.amount : n),
      0,
    );
    expect([...m.healed.values()].reduce((n, d) => n + d, 0)).toBe(healExpected);
    expect(meterHtml(m, 'healing')).toContain('data-tab="healing"');
  });
});

describe('meter heals', () => {
  test('a heal counts for its healer, not the unit healed', () => {
    const fight = {
      home: 'a',
      result: {
        fighters: [
          { id: 0, side: 0, defId: 'melina', star: 1 },
          { id: 1, side: 0, defId: 'titan', star: 1 },
          { id: 2, side: 1, defId: 'titan', star: 1 },
        ],
        events: [],
      },
    } as unknown as Parameters<typeof createMeter>[0];
    const m = createMeter(fight, 'a');
    recordEvent(m, { t: 1, type: 'heal', id: 1, by: 0, amount: 50, hp: 100 });
    recordEvent(m, { t: 2, type: 'heal', id: 1, amount: 20, hp: 120 });
    recordEvent(m, { t: 3, type: 'attack', id: 2, target: 1, damage: 30, hp: 90, mana: 0, targetMana: 0 });
    expect(m.healed.get(0)).toBe(50);
    expect(m.healed.get(1)).toBe(20);
    expect(m.taken.get(1)).toEqual({ attack: 30, skill: 0 });
  });
});

describe('damage meter with summons', () => {
  test("a summon's hits count for its owner, and trait damage on a summon doesn't crash", async () => {
    const { createMeter, recordEvent } = await import('./meter');
    const fight = {
      home: 'a',
      away: 'b',
      ghost: false,
      damage: 0,
      result: {
        fighters: [
          { id: 0, side: 0, defId: 'melina', star: 1, x: 0, y: 5, hp: 1, maxHp: 1, mana: 0, maxMana: 1, onTile: false, chosen: null, leads: [], items: [], orb: null, mistOrbs: [] },
          { id: 1, side: 1, defId: 'titan', star: 1, x: 0, y: 0, hp: 1, maxHp: 1, mana: 0, maxMana: 1, onTile: false, chosen: null, leads: [], items: [], orb: null, mistOrbs: [] },
        ],
        traits: [{}, {}],
        events: [],
        ticks: 0,
        winner: null,
        survivors: [],
      },
    } as unknown as Parameters<typeof createMeter>[0];
    const m = createMeter(fight, 'a');
    const archer = { ...fight.result.fighters[0], id: 2, defId: 'spiritarcher' };
    recordEvent(m, { t: 1, type: 'summon', owner: 0, fighter: archer });
    recordEvent(m, { t: 2, type: 'attack', id: 2, target: 1, damage: 40, hp: 0, mana: 0, targetMana: 0 });
    recordEvent(m, { t: 3, type: 'effect', effect: 'skybringer', target: 2, damage: 10, hp: 0 });
    expect(m.byUnit.get(0)!.attack).toBe(40);
    expect(m.byTrait.size).toBe(0); // landed on our side: not ours
  });
});

