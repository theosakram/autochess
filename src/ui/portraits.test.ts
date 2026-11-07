import { describe, expect, test } from 'bun:test';
import { UNITS } from '../game/units';
import { PORTRAITS, portraitHtml } from './portraits';
import { TIER_COLORS } from './stage/theme';

describe('hero portraits', () => {
  test('every hero has a picture, and no two share one', () => {
    for (const u of UNITS) expect(PORTRAITS[u.id]).toBeTruthy();
    const pictures = Object.values(PORTRAITS);
    expect(new Set(pictures).size).toBe(pictures.length);
    expect(pictures.length).toBe(UNITS.length);
  });

  test('the plate follows the cost: wanderers are 5-gold gold, the 7-gold is its own colour', () => {
    const plate = (id: string) => portraitHtml(id).match(/--plate:#(\w+)/)![1];
    const hex = (tier: number) => TIER_COLORS[tier].toString(16).padStart(6, '0');
    expect(plate('phove')).toBe(hex(1));
    expect(plate('balia')).toBe(hex(5));
    expect(plate('cyborg')).toBe(hex(5));
    expect(plate('bossalpha')).toBe(hex(7));
    expect(new Set(Object.values(TIER_COLORS)).size).toBe(Object.keys(TIER_COLORS).length);
  });
});
