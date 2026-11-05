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
  });
});
