import { describe, expect, test } from 'bun:test';
import { TRAITS } from '../game/traits';
import { UNITS } from '../game/units';
import { ITEMS } from '../game/items';
import { badgeSvg, BEARER_BADGES, bearerBadgeHtml, paths, TRAIT_BADGES, traitBadgeHtml } from './traitBadges';

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
});
