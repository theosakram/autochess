import { describe, expect, test } from 'bun:test';
import { MAX_ITEMS_PER_UNIT } from '../game/config';
import { createGame } from '../game/game';
import { ITEMS } from '../game/items';
import { playerTraitCounts, traitCounts } from '../game/traits';
import {
  BUILDER_MAX_HEROES,
  builderPlayer,
  emptyBoard,
  filterHeroes,
  giveOrb,
  NO_FILTER,
  takeOrb,
  giveItem,
  heroCount,
  itemBlock,
  moveHero,
  parseTeams,
  placeHero,
  removeHero,
  saveTeam,
  takeItem,
  teamBuilderHtml,
  lineupGuide,
  lineupPanelHtml,
} from './teamBuilder';

const blank = () => ({ ...createGame(0, [{ id: 'v', name: '', isBot: false }]).players[0], bench: [], board: [] });
const anyItem = Object.values(ITEMS).find((i) => !i.membersOnly && !i.forbidden && !i.enhancedFrom)!;

describe('Team Builder', () => {
  test('place, move (swap) and remove heroes; capped at the hero limit', () => {
    let b = placeHero(emptyBoard(), 'minos', 3);
    b = placeHero(b, 'martin'); // first free cell
    expect([b[0]?.defId, b[3]?.defId]).toEqual(['martin', 'minos']);
    b = moveHero(b, 0, 3);
    expect([b[0]?.defId, b[3]?.defId]).toEqual(['minos', 'martin']);
    b = removeHero(b, 0);
    expect(heroCount(b)).toBe(1);
    for (let i = 0; i < 30; i++) b = placeHero(b, 'minos');
    expect(heroCount(b)).toBe(BUILDER_MAX_HEROES);
  });

  test('items: only on heroes, at most the per-hero cap; click removes', () => {
    let b = placeHero(emptyBoard(), 'minos', 0);
    expect(itemBlock(b, 1, anyItem.id)).not.toBeNull(); // empty cell
    for (let i = 0; i < 5; i++) b = giveItem(b, 0, anyItem.id);
    expect(b[0]!.items).toHaveLength(MAX_ITEMS_PER_UNIT);
    b = takeItem(b, 0, 0);
    expect(b[0]!.items).toHaveLength(MAX_ITEMS_PER_UNIT - 1);
  });

  test('synergies count each hero type once, like the game', () => {
    let b = placeHero(emptyBoard(), 'minos', 0);
    b = placeHero(b, 'minos', 1);
    b = placeHero(b, 'martin', 2);
    expect(traitCounts(builderPlayer(blank(), b).board).astral).toBe(2);
    expect(teamBuilderHtml({ board: b, tab: 'heroes', filter: NO_FILTER, filterOpen: false, teams: [], name: '', selected: '', message: '' }, builderPlayer(blank(), b))).toContain('data-trait="astral"');
  });

  test('saving replaces a same-named team; parsing drops unknown heroes and junk', () => {
    const b = giveItem(placeHero(emptyBoard(), 'minos', 4), 4, anyItem.id);
    let teams = saveTeam([], 'A', b);
    teams = saveTeam(teams, 'A', placeHero(b, 'martin', 0));
    expect(teams).toHaveLength(1);
    const back = parseTeams(JSON.stringify([...teams, { name: 'B', board: [{ defId: 'nobody', items: [] }] }, 'junk']));
    expect(back.map((t) => t.name)).toEqual(['A', 'B']);
    expect(back[0].board[4]).toEqual({ defId: 'minos', items: [anyItem.id] });
    expect(heroCount(back[1].board)).toBe(0);
    expect(parseTeams('not json')).toEqual([]);
  });

  test('orbs: one per hero, its own trait allowed (+1); it counts toward the synergy and is saved', () => {
    let b = placeHero(emptyBoard(), 'minos', 0); // astral
    expect(playerTraitCounts(builderPlayer(blank(), giveOrb(b, 0, 'astral'))).astral).toBe(2); // Astral + Astral orb
    b = giveOrb(b, 0, 'mage');
    b = giveOrb(b, 0, 'hunter'); // replaces
    expect(b[0]!.orb).toBe('hunter');
    expect(playerTraitCounts(builderPlayer(blank(), b)).hunter).toBe(1);
    expect(parseTeams(JSON.stringify(saveTeam([], 'O', b)))[0].board[0]!.orb).toBe('hunter');
    expect(takeOrb(b, 0)[0]!.orb).toBeUndefined();
  });

  test('filters: faction, role and cost combine', () => {
    const astral = filterHeroes({ ...NO_FILTER, faction: 'astral' });
    expect(astral.length).toBeGreaterThan(0);
    expect(astral.every((u) => u.traits.includes('astral'))).toBe(true);
    const narrow = filterHeroes({ faction: 'astral', role: 'mage', cost: 5 });
    expect(narrow.map((u) => u.id)).toEqual(['odette']);
  });
});

describe('Lineups (in game)', () => {
  test('the guide lists each planned hero with its cell; the panel marks the loaded one and heroes in place', () => {
    let b = placeHero(emptyBoard(), 'minos', 2);
    b = placeHero(b, 'martin', 9);
    const team = saveTeam([], 'Plan', b)[0];
    expect(lineupGuide(team)).toEqual([
      { cell: 2, defId: 'minos' },
      { cell: 9, defId: 'martin' },
    ]);
    const p = builderPlayer(blank(), placeHero(emptyBoard(), 'minos', 2)); // Minos owned and in place; Martin not owned
    const html = lineupPanelHtml([team], 'Plan', p);
    expect(html).toContain('👍 Plan');
    expect(html).toContain('lineup-face owned placed');
    expect(html).toContain('data-action="unloadLineup"');
    expect(lineupPanelHtml([], null, p)).toContain('Team Builder');
  });
});
