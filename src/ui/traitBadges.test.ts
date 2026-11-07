import { describe, expect, test } from 'bun:test';
import { TRAITS } from '../game/traits';
import { UNITS } from '../game/units';
import { ITEMS } from '../game/items';
import { badgeSvg, BEARER_BADGES, bearerBadgeHtml, centering, iconBounds, paths, shiftPath, TRAIT_BADGES, traitBadgeHtml } from './traitBadges';

describe('trait badges', () => {
  test('every trait has a badge, and no two share a colour or an icon', () => {
    const ids = Object.keys(TRAITS);
    expect(Object.keys(TRAIT_BADGES).sort()).toEqual(ids.sort());
    const all = Object.values(TRAIT_BADGES);
    expect(new Set(all.map((b) => b.color)).size).toBe(ids.length);
    expect(new Set(all.map((b) => b.d)).size).toBe(ids.length);
  });

  test('each shape is its own path, so holes never come from overlap', () => {
    expect(paths('M1 1L2 2Z M3 3L4 4Z')).toEqual(['M1 1L2 2Z', 'M3 3L4 4Z']);
    expect(badgeSvg(TRAIT_BADGES.dauntless).match(/<path/g)).toHaveLength(2);
    expect(badgeSvg(TRAIT_BADGES.spectre).match(/<path/g)).toHaveLength(3); // body, two eyes
  });

  test('every kind of bearer has a badge unlike any trait badge', () => {
    const carried = [...UNITS.flatMap((u) => (u.honorary ? [u.honorary.trait] : [])), ...Object.values(ITEMS).flatMap((i) => (i.grantsMembership ? [i.grantsMembership.trait] : []))];
    for (const trait of carried) expect(BEARER_BADGES[trait]).toBeDefined();
    const all = [...Object.values(TRAIT_BADGES), ...Object.values(BEARER_BADGES)];
    expect(new Set(all.map((b) => b.color)).size).toBe(all.length);
    expect(bearerBadgeHtml('necromancer')).not.toContain('#085d6c');
  });

  test('a badge is an svg on the trait colour, with no emoji', () => {
    const html = traitBadgeHtml('astral');
    expect(html).toContain('<svg');
    expect(html).toContain('background:#5d6ea6');
    expect(html).toContain('fill="#211f63"');
    expect(html).not.toContain(TRAITS.astral.icon);
  });

  test('every icon is drawn dead centre on its badge, cut and all', () => {
    for (const b of [...Object.values(TRAIT_BADGES), ...Object.values(BEARER_BADGES)]) {
      const svg = badgeSvg(b);
      const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
      const icon = iconBounds(ds.slice(0, paths(b.d).length).join(' '));
      expect((icon.minX + icon.maxX) / 2).toBeCloseTo(12, 1);
      expect((icon.minY + icon.maxY) / 2).toBeCloseTo(12, 1);
    }
  });

  test('shifting a path moves every point, curves too, and keeps its shape', () => {
    expect(shiftPath('M1 2L3 4H5V6C7 8 9 10 11 12Z', 1, -1)).toBe('M 2 1 L 4 3 H 6 V 5 C 8 7 10 9 12 11 Z');
    // The Mage hat sat 2 high (it spans 2 to 18): it's moved down by 2.
    expect(centering(TRAIT_BADGES.mage.d)).toEqual({ dx: 0, dy: 2 });
  });
});
