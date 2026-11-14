import { describe, expect, test } from 'bun:test';
import { Glob } from 'bun';
import { createGame } from '../../game/game';
import { COMMANDERS } from '../../game/commanders';
import { EMOJI, emojiSvg, iconize, UI_ICONS } from './emoji';
import { PORTRAITS } from '../portraits';
import { galleryHtml, homeGalleryHtml, hudHtml, shopDockHtml, traitsPanelHtml, unitInfoHtml } from '../views';
import { portraitHtml } from '../portraits';

// Hero portraits stay emoji for now (portraits.ts); everything else is drawn.
const heroOnly = new Set(Object.values(PORTRAITS).map((e) => [...e][0]));

describe('emoji drawings', () => {
  test('every emoji in the code has a drawing, hero portraits aside', async () => {
    const missing = new Set<string>();
    for await (const f of new Glob('src/**/*.ts').scan('.')) {
      if (f.includes('.test.') || f.includes('portraits')) continue;
      for (const [e] of (await Bun.file(f).text()).matchAll(EMOJI)) if (!emojiSvg(e)) missing.add(e);
    }
    expect([...missing]).toEqual([]);
  });

  test('the UI drawings are plain flat SVG the board can parse', () => {
    for (const [e, body] of Object.entries(UI_ICONS)) {
      expect(body, e).not.toMatch(/Gradient|url\(|transform|id=/);
      expect(body.match(/<\w+/g)!.every((t) => ['<path', '<circle', '<rect'].includes(t)), e).toBe(true);
    }
  });

  test('iconize swaps text emoji, drops them from attributes, keeps hero portraits', () => {
    const html = iconize(`<button title="🔮 Orb">🔮 Use</button>`);
    expect(html).toContain('title="Orb"');
    expect(html).toContain('<img class="svg-icon emo"');
    expect(html).not.toMatch(EMOJI);
    const portrait = portraitHtml('phove');
    expect(iconize(portrait)).toBe(portrait);
  });

  test('rendered panels show no emoji but hero portraits', () => {
    const state = createGame(1, [{ id: 'a', name: 'A', isBot: false }]);
    const p = state.players[0];
    p.commander = Object.keys(COMMANDERS)[0];
    const pages = [
      hudHtml(state, p, 'B'),
      shopDockHtml(p, state.round, false, state.chosen, false, state.pool),
      traitsPanelHtml(p),
      unitInfoHtml('val', p),
      galleryHtml(p, state.chosen, 'cards'),
      ...(['heroes', 'commanders', 'cards', 'items', 'synergies', 'crossovers'] as const).map((t) => homeGalleryHtml(p, t)),
    ];
    for (const page of pages) {
      const left = [...iconize(page).matchAll(EMOJI)].map(([e]) => e).filter((e) => !heroOnly.has([...e][0]));
      expect(left).toEqual([]);
    }
  });
});
