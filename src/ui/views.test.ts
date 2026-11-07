import { describe, expect, test } from 'bun:test';
import { createGame } from '../game/game';
import { orbOptions } from '../game/orb';
import { auraGrants, fieldStats } from '../game/inventory';
import { playerTraits } from '../game/traits';
import { traitBadgeHtml } from './traitBadges';
import { armoryHtml, shopDockHtml, bearerDetailHtml, galleryHtml, itemDetailHtml, graveHtml, orbChoiceHtml, playersHtml, traitsPanelHtml, unitDetailHtml, unitInfoHtml } from './views';
import { SKILLS } from '../game/skills';

describe('orb choice popup', () => {
  // Regression: options carried data-trait, which the click handler treats as "open trait popup",
  // so picking an option opened that trait's popup instead of applying the orb.
  test('options are orb actions, never trait-popup links', () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.orbs.push(42);
    p.board[0] = { uid: 900, defId: 'angela', star: 1 };
    const html = orbChoiceHtml(p, 900);
    expect(html).not.toContain('data-trait=');
    for (const trait of orbOptions(42, 'angela')) expect(html).toContain(`data-action="useOrb" data-orb-trait="${trait}"`);
  });
});

describe('shop cards', () => {
  const setup = () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.board.fill(null);
    p.bench.fill(null);
    p.gold = 100;
    p.shop = ['val', 'bossalpha', null, null, null];
    return { state, p, html: () => shopDockHtml(p, state.round, false, state.chosen, false, state.pool) };
  };

  test('owned heroes are flagged with their stars; a copy that completes a merge says STAR UP', () => {
    const { p, html } = setup();
    expect(html()).not.toContain('shop-flag');
    p.bench[0] = { uid: 1, defId: 'val', star: 1 };
    expect(html()).toContain('✓ Have 1★');
    p.bench[1] = { uid: 2, defId: 'val', star: 1 };
    expect(html()).toContain('★★ STAR UP');
    // Boss Alpha merges four at a time: two copies are not enough.
    p.bench[2] = { uid: 3, defId: 'bossalpha', star: 1 };
    p.bench[3] = { uid: 4, defId: 'bossalpha', star: 1 };
    expect(html().match(/STAR UP/g)).toHaveLength(1);
    p.bench[4] = { uid: 5, defId: 'bossalpha', star: 1 };
    expect(html().match(/STAR UP/g)).toHaveLength(2);
  });

  test('traits you field are lit with the count buying brings; copies left in the pool are shown', () => {
    const { state, p, html } = setup();
    p.board[0] = { uid: 1, defId: 'harley', star: 1 }; // shares Necromancer with Val
    expect(html()).toMatch(/shop-trait have[^"]*"[^>]*>.*?<em>1→2<\/em>/);
    expect(html()).toContain(`(${state.pool.val + 1}/25)`);
  });
});

describe('synergy panel', () => {
  test('the Offering bearer gets its own 1/1 tile', () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.board.fill(null);
    p.bench.fill(null);
    p.board[0] = { uid: 1, defId: 'cici', star: 1 };
    p.board[1] = { uid: 2, defId: 'zhuxin', star: 1 };
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
    const row = card.slice(card.indexOf('Balang'), card.indexOf('</li>', card.indexOf('Balang')));
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
    expect(cell('fighter')).toContain('Balang');
    expect(cell('mage')).not.toContain('Balang');
    // Frank has two roles, so it's in both rows.
    const gw = cols.findIndex((c) => c.includes('data-trait="gustiwana"'));
    const at = (role: string) => [...row(role).matchAll(/<td>([\s\S]*?)<\/td>/g)][gw][1];
    expect(at('weaponmaster')).toContain('Frank');
    expect(at('dauntless')).toContain('Frank');
  });
});

describe('Plane Wanderers in the gallery', () => {
  const state = createGame(1, [{ id: 'p', name: 'P', isBot: false }]);
  const p = state.players[0];

  test('the Necromancer card lists them as bearers; their role cards link back to Necromancer', () => {
    const html = galleryHtml(p, state.chosen);
    const necro = html.slice(html.indexOf('Necromancer <small>'), html.indexOf('</article>', html.indexOf('Necromancer <small>')));
    const bearers = necro.slice(necro.indexOf('Bearers'));
    for (const name of ['Gatotkaca', 'Moscow', 'Amon', 'Cyborg', 'Novaria']) expect(bearers).toContain(name);
    const fighter = html.slice(html.indexOf('Fighter <small>'), html.indexOf('</article>', html.indexOf('Fighter <small>')));
    const row = fighter.slice(fighter.indexOf('Gatotkaca'), fighter.indexOf('</li>', fighter.indexOf('Gatotkaca')));
    expect(row).toContain('bearer-chip');
    expect(row).toContain('data-trait="necromancer"');
  });

  test('in the crossover grid they sit under Necromancer, in their role row', () => {
    const html = galleryHtml(p, state.chosen, 'grid');
    const rows = [...html.matchAll(/<tr><th scope="row">([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
    const cols = [...html.matchAll(/<th scope="col">([\s\S]*?)<\/th>/g)].map((m) => m[1]);
    const necro = cols.findIndex((c) => c.includes('data-trait="necromancer"'));
    const fighterRow = rows.find((r) => r.includes('data-trait="fighter"'))!;
    expect([...fighterRow.matchAll(/<td>([\s\S]*?)<\/td>/g)][necro][1]).toContain('Gatotkaca');
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
    ['val', 'natalie', 'harley', 'tig', 'phove', 'ginger'].forEach((d, i) => (b.board[i] = { uid: 500 + i, defId: d, star: 1 }));
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
    for (const tab of ['cards', 'grid'] as const) expect(galleryHtml(p, state.chosen, tab)).toContain('data-unit-info="saber"');
  });

  test("stats at every star, and the skill with each star's numbers", () => {
    const html = unitInfoHtml('saber', p);
    expect(html).toContain('Soul Orbit');
    expect(html).toContain('135%');
    expect(html).toContain('210%');
    for (const hp of [2575, 4635, 8760]) expect(html).toContain(`<td>${hp}</td>`);
    expect(html).toContain('data-trait="spectre"');
    expect(unitInfoHtml('gatotkaca', p)).toContain('Not in the shop');
    expect(unitInfoHtml('bossalpha', p)).toContain('Spectral Cataclysm');
  });
});


describe('equipment panel', () => {
  const setup = () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.board.fill(null);
    p.bench.fill(null);
    p.board[0] = { uid: 1, defId: 'cici', star: 1 };
    p.board[1] = { uid: 2, defId: 'divinebeast', star: 1 };
    p.bench[0] = { uid: 3, defId: 'phove', star: 1 };
    p.items = [{ uid: 9, id: 'keris', tier: 1, holder: 1 }, { uid: 10, id: 'aegis', tier: 1, holder: null }];
    return p;
  };
  const slotsOf = (html: string, attr: string) => html.split(attr).length - 1;

  test('owned equipment on top, then each deployed hero with 1 orb slot and 3 equipment slots', () => {
    const p = setup();
    const html = armoryHtml(p);
    expect(html.indexOf('armory-stash')).toBeLessThan(html.indexOf('gear-heroes'));
    expect(slotsOf(html, 'data-orb-unit="1"')).toBe(1);
    expect(slotsOf(html, 'data-gear-unit="1"')).toBe(3);
    // Worn or not, everything owned is listed at the top; worn items also sit in their slot.
    expect(slotsOf(html, 'data-item="9"')).toBe(2);
    expect(slotsOf(html, 'data-item="10"')).toBe(1);
  });

  test('commander pieces and benched heroes get no card', () => {
    const html = armoryHtml(setup());
    expect(html).not.toContain('data-gear-unit="2"');
    expect(html).not.toContain('data-gear-unit="3"');
  });

  test('unused Magic Orbs and Mist orbs are listed; a held Mist orb sits in the orb slot', () => {
    const p = setup();
    p.orbs = [7];
    p.mistOrbs = [{ uid: 50, trait: 'mage', holder: 1 }];
    const html = armoryHtml(p);
    expect(html).toContain('data-orb="magic"');
    const slot = html.slice(html.indexOf('data-orb-unit="1"'), html.indexOf('gear-slots'));
    expect(slot).toContain('data-orb="50"');
  });

  test('a faction or role orb shows its trait; the Magic Orb stays a 🔮', () => {
    const p = setup();
    p.mistOrbs = [{ uid: 50, trait: 'mage', holder: 1 }];
    p.board[2] = { uid: 4, defId: 'irina', star: 1 };
    p.orb = { defId: 'irina', trait: 'astral' };
    const html = armoryHtml(p);
    const slot = (uid: number) => html.slice(html.indexOf(`data-orb-unit="${uid}"`)).split('</div>')[0];
    expect(slot(1)).toContain(traitBadgeHtml('mage'));
    expect(slot(1)).not.toContain('🔮');
    expect(slot(1)).toContain('Role Orb');
    expect(slot(4)).toContain('🔮');
    expect(slot(4)).toContain(traitBadgeHtml('astral'));
  });
});

describe('item popup', () => {
  const setup = () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.board.fill(null);
    p.bench.fill(null);
    p.board[0] = { uid: 1, defId: 'angela', star: 1 };
    p.items = [{ uid: 9, id: 'keris', tier: 1, holder: 1 }, { uid: 10, id: 'waraxe', tier: 1, holder: null }];
    return p;
  };

  test('tells what the item does, who holds it and who may', () => {
    const html = itemDetailHtml(setup(), 9, true);
    expect(html).toContain('Keris');
    expect(html).toContain('Justice');
    expect(html).toContain('Angela');
    expect(html).toContain('Only');
    expect(html).toContain('data-action="takeOffItem"');
    expect(html).toContain('data-action="closeItem"');
  });

  test('a loose item can be equipped; in a fight there are no buttons', () => {
    const p = setup();
    expect(itemDetailHtml(p, 10, true)).toContain('data-action="pickUpItem"');
    expect(itemDetailHtml(p, 10, true)).not.toContain('takeOffItem');
    expect(itemDetailHtml(p, 10, false)).not.toContain('pickUpItem');
  });
});

describe('grave', () => {
  test('names the Plane Wanderer rolled for this player, and opens its card', () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.stacks = { necromancer: 12 };
    p.rewardUnit = { necromancer: 'amon' };
    const html = graveHtml(p);
    expect(html).toContain('data-unit-info="amon"');
    expect(html).toContain('Amon');
  });

  test('shows the rolled Plane Wanderer with its role icon', () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.stacks = { necromancer: 12 };
    p.rewardUnit = { necromancer: 'cyborg' };
    expect(graveHtml(p)).toContain(`${traitBadgeHtml('dauntless')} Cyborg`);
    expect(galleryHtml(p, state.chosen)).toContain(`${traitBadgeHtml('dauntless')} Cyborg`);
  });
});

describe('skill damage colours', () => {
  test('every damage key is a real {placeholder} of its skill', () => {
    for (const s of Object.values(SKILLS)) {
      const values = s.values();
      for (const key of Object.keys(s.damage ?? {})) {
        expect(values[key], `${s.id}.${key}`).toBeDefined();
        expect(s.desc, `${s.id}.${key}`).toContain(`{${key}}`);
      }
    }
  });

  // Catches a new skill whose text says "... as physical damage" without saying so in `damage`.
  test('a number the text calls physical or magic damage is tagged that type', () => {
    for (const s of Object.values(SKILLS)) {
      for (const m of s.desc.matchAll(/\{(\w+)\}([^{.]*?) as (physical|magic) damage/g)) {
        const kind = s.damage?.[m[1]];
        expect(kind === m[3] || kind === 'attack', `${s.id}.${m[1]}`).toBe(true);
      }
    }
  });

  test('hero details colour skill damage: red physical, teal magic, by basic attack type for empowered attacks', () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    const info = (id: string) => unitInfoHtml(id, p);
    expect(info('suyu')).toContain('class="dmg-physical"');
    expect(info('suyu')).not.toContain('class="dmg-magic"');
    expect(info('belle')).toContain('class="dmg-magic"');
    expect(info('alice')).toContain('class="dmg-magic"');
    // Cici's double strike is her basic attack: physical.
    expect(info('cici')).toContain('class="dmg-physical"');
    p.board[0] = { uid: 77, defId: 'thamar', star: 2 };
    const pop = unitDetailHtml(p, 77, {}, true);
    expect(pop).toContain('class="dmg-physical"');
    expect(pop).toContain('class="calc dmg-physical"');
  });
});
