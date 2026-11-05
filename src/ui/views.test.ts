import { describe, expect, test } from 'bun:test';
import { createGame } from '../game/game';
import { orbOptions } from '../game/orb';
import { auraGrants, fieldStats } from '../game/inventory';
import { playerTraits } from '../game/traits';
import { bearerDetailHtml, orbChoiceHtml, traitsPanelHtml } from './views';

describe('orb choice popup', () => {
  // Regression: options carried data-trait, which the click handler treats as "open trait popup",
  // so picking an option opened that trait's popup instead of applying the orb.
  test('options are orb actions, never trait-popup links', () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.orbs.push(42);
    p.board[0] = { uid: 900, defId: 'penari', star: 1 };
    const html = orbChoiceHtml(p, 900);
    expect(html).not.toContain('data-trait=');
    for (const trait of orbOptions(42, 'penari')) expect(html).toContain(`data-action="useOrb" data-orb-trait="${trait}"`);
  });
});

describe('synergy panel', () => {
  test('the Offering bearer gets its own 1/1 tile', () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.board.fill(null);
    p.bench.fill(null);
    p.board[0] = { uid: 1, defId: 'kindler', star: 1 };
    p.board[1] = { uid: 2, defId: 'ashbinder', star: 1 };
    p.board[2] = { uid: 3, defId: 'wraith', star: 1 };
    p.items = [{ uid: 9, id: 'offering', tier: 1, holder: 3 }];
    const html = traitsPanelHtml(p);
    expect(html).toContain('class="trait-tile bearer active" data-bearer="9"');
    expect(html).toContain('<span class="trait-count">1/1</span>');

    // Its popup is about the bearer, with the exact attack the cult gets (the same number combat adds).
    const levels = playerTraits(p);
    const grant = auraGrants(p, levels).get(9)!;
    const gained = fieldStats(p, levels).get(1)!.atk - fieldStats({ ...p, items: [] }, levels).get(1)!.atk;
    expect(grant.amount).toBe(gained);
    const popup = bearerDetailHtml(p, 9, {});
    expect(popup).toContain('Pyre Offering bearer');
    expect(popup).toContain(`+${grant.amount} attack`);
    expect(popup).not.toContain('data-trait=');
    p.items[0].holder = null;
    expect(traitsPanelHtml(p)).not.toContain('bearer');
  });
});
