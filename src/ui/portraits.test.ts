import { HERO_SVGS } from './icons';
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

  test('the plate follows the cost (unless a hand-made icon brings its own), and the 7-gold is its own colour', () => {
    const plate = (id: string) => portraitHtml(id).match(/--plate:#(\w+)/)![1];
    const hex = (tier: number) => TIER_COLORS[tier].toString(16).padStart(6, '0');
    expect(plate('phove')).toBe(hex(1));
    expect(plate('elderdrake')).toBe(hex(5)); // a summon: every 5-gold hero has its own icon plate now
    // A hand-made icon's plate wins: Boss Alpha (7-gold) is on Spectre navy.
    expect(plate('bossalpha')).toBe(HERO_SVGS.bossalpha.plate.slice(1));
    expect(new Set(Object.values(TIER_COLORS)).size).toBe(Object.keys(TIER_COLORS).length);
  });
});
