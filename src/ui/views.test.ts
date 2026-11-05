import { describe, expect, test } from 'bun:test';
import { createGame } from '../game/game';
import { orbOptions } from '../game/orb';
import { auraGrants, fieldStats } from '../game/inventory';
import { playerTraits } from '../game/traits';
import { bearerDetailHtml, galleryHtml, orbChoiceHtml, playersHtml, traitsPanelHtml, unitInfoHtml } from './views';

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
    p.board[2] = { uid: 3, defId: 'titan', star: 1 };
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

describe('synergy gallery', () => {
  const state = createGame(1, [{ id: 'p', name: 'P', isBot: false }]);
  const p = state.players[0];

  test("each unit in a trait card lists its other traits as clickable chips", () => {
    const html = galleryHtml(p, state.chosen);
    const card = html.slice(html.indexOf('Skybringer'), html.indexOf('</article>', html.indexOf('Skybringer')));
    const row = card.slice(card.indexOf('Thunder Lord'), card.indexOf('</li>', card.indexOf('Thunder Lord')));
    expect(row).toContain('data-trait="fighter"');
    expect(row).not.toContain('data-trait="skybringer"');
  });

  test('the crossover grid puts each unit where its faction and role meet', () => {
    const html = galleryHtml(p, state.chosen, 'grid');
    const rows = [...html.matchAll(/<tr><th scope="row">([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
    const row = (role: string) => rows.find((r) => r.includes(`data-trait="${role}"`))!;
    const cols = [...html.matchAll(/<th scope="col">([\s\S]*?)<\/th>/g)].map((m) => m[1]);
    const col = cols.findIndex((c) => c.includes('data-trait="skybringer"'));
    const cell = (role: string) => [...row(role).matchAll(/<td>([\s\S]*?)<\/td>/g)][col][1];
    expect(cell('fighter')).toContain('Thunder Lord');
    expect(cell('mage')).not.toContain('Thunder Lord');
    // Dalang has two roles, so it's in both rows.
    const gw = cols.findIndex((c) => c.includes('data-trait="gustiwana"'));
    const at = (role: string) => [...row(role).matchAll(/<td>([\s\S]*?)<\/td>/g)][gw][1];
    expect(at('weaponmaster')).toContain('Dalang');
    expect(at('dauntless')).toContain('Dalang');
  });
});

describe('Plane Wanderers in the gallery', () => {
  const state = createGame(1, [{ id: 'p', name: 'P', isBot: false }]);
  const p = state.players[0];

  test('the Necromancer card lists them as bearers; their role cards link back to Necromancer', () => {
    const html = galleryHtml(p, state.chosen);
    const necro = html.slice(html.indexOf('Necromancer <small>'), html.indexOf('</article>', html.indexOf('Necromancer <small>')));
    const bearers = necro.slice(necro.indexOf('Bearers'));
    for (const name of ['Wandering Blade', 'Wandering Eye', 'Wandering Hunter', 'Wandering Bastion', 'Wandering Seer']) expect(bearers).toContain(name);
    const fighter = html.slice(html.indexOf('Fighter <small>'), html.indexOf('</article>', html.indexOf('Fighter <small>')));
    const row = fighter.slice(fighter.indexOf('Wandering Blade'), fighter.indexOf('</li>', fighter.indexOf('Wandering Blade')));
    expect(row).toContain('bearer-chip');
    expect(row).toContain('data-trait="necromancer"');
  });

  test('in the crossover grid they sit under Necromancer, in their role row', () => {
    const html = galleryHtml(p, state.chosen, 'grid');
    const rows = [...html.matchAll(/<tr><th scope="row">([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
    const cols = [...html.matchAll(/<th scope="col">([\s\S]*?)<\/th>/g)].map((m) => m[1]);
    const necro = cols.findIndex((c) => c.includes('data-trait="necromancer"'));
    const fighterRow = rows.find((r) => r.includes('data-trait="fighter"'))!;
    expect([...fighterRow.matchAll(/<td>([\s\S]*?)<\/td>/g)][necro][1]).toContain('Wandering Blade');
  });
});

describe('players list', () => {
  test("shows each live opponent's active synergies, strongest first, and none for knocked-out ones", () => {
    const state = createGame(1, [
      { id: 'a', name: 'A', isBot: false },
      { id: 'b', name: 'B', isBot: true },
      { id: 'c', name: 'C', isBot: true },
    ]);
    const [, b, c] = state.players;
    b.board.fill(null);
    ['boneadept', 'banshee', 'shadewalker', 'cryptwarden', 'wisp', 'gloomshot'].forEach((d, i) => (b.board[i] = { uid: 500 + i, defId: d, star: 1 }));
    c.hp = 0;
    c.place = 3;
    const html = playersHtml([b, c], (p) => p.hp, null);
    const row = html.slice(html.indexOf('>B<'), html.indexOf('</li>', html.indexOf('>B<')));
    expect(row.indexOf('data-trait="necromancer"')).toBeGreaterThan(-1);
    expect(row.indexOf('data-trait="necromancer"')).toBeLessThan(row.indexOf('data-trait="spectre"'));
    expect(row).toContain('<b>4</b>');
    const out = html.slice(html.indexOf('>C<'));
    expect(out).not.toContain('opp-trait');
  });
});

describe('unit info popup', () => {
  const state = createGame(1, [{ id: 'p', name: 'P', isBot: false }]);
  const p = state.players[0];

  test('every unit name in the gallery opens it', () => {
    for (const tab of ['cards', 'grid'] as const) expect(galleryHtml(p, state.chosen, tab)).toContain('data-unit-info="soulreaper"');
  });

  test("stats at every star, and the skill with each star's numbers", () => {
    const html = unitInfoHtml('soulreaper', p);
    expect(html).toContain('Soul Orbit');
    expect(html).toContain('45%');
    expect(html).toContain('100%');
    for (const hp of [900, 1620, 2916]) expect(html).toContain(`<td>${hp}</td>`);
    expect(html).toContain('data-trait="spectre"');
    expect(unitInfoHtml('wanderingblade', p)).toContain('Not in the shop');
    expect(unitInfoHtml('galekin', p)).toContain('placeholder');
  });
});

