import { pct } from '../traits/format';
import { term } from './terms';
import type { CommanderDef, EnhancePower } from './types';

// Tune with `bun run balance`. Per level of the enhanced trait, index 0 = first breakpoint (2/4/6).
// `members`: only the trait's own units get it (as the trait's own bonus works); otherwise every ally.
export const FREYA = {
  enhance: {
    traits: {
      fighter: { text: 'basic attack damage', members: true, mods: [{ stat: 'basicAmp', add: [0.05, 0.1, 0.2] }] },
      dauntless: { text: 'max HP as a starting shield', members: false, mods: [{ stat: 'startShield', add: [0.05, 0.2, 0.25] }] },
      defender: { text: 'armor and magic resist', members: false, mods: [{ stat: 'armor', add: [10, 20, 30] }, { stat: 'mr', add: [10, 20, 30] }] },
      deadeye: { text: 'crit chance', members: false, mods: [{ stat: 'critChance', add: [0.05, 0.1, 0.25] }] },
      mage: { text: 'magic attack', members: false, mods: [{ stat: 'ap', pct: [0.1, 0.2, 0.3] }] },
      stargazer: { text: 'mana/sec', members: false, mods: [{ stat: 'manaRegen', add: [2, 4, 6] }] },
      hunter: { text: 'armor and magic resist shred on attacks', members: false, mods: [{ stat: 'armorShred', add: [10, 25, 30] }] },
    },
    // Claimable once each per game, at the enhanced trait's 2/4/6: two random heroes of it worth this much.
    rewardGold: [4, 5, 8],
  } satisfies EnhancePower,
  // The card: on each claim, extra. 2: gold; 4: an Equipment Chest; 6: a random faction or role orb.
  cardGold: 10,
};

// "+5/10/20%" or "+10/20/30": a bonus's three values, as the trait panel shows them.
export function enhanceValues(mod: { stat: string; add?: number[]; pct?: number[] }): string {
  const v = mod.add ?? mod.pct!;
  const asPct = !!mod.pct || v.every((n) => n < 1);
  return '+' + v.map((n) => (asPct ? pct(n) : String(n))).join('/');
}

// The per-role bonuses sit behind this link (the UI adds their table: views.ts, TERM_TABLES).
const SPECIAL_BONUS = term('specialBonus', 'Special Bonus');

export const freya: CommanderDef = {
  id: 'freya',
  name: 'Freya',
  icon: '🌸',
  title: 'Lady of the Blessed Fields',
  desc:
    `Bless a role (change it any time): at 2/4/6 it gets a ${SPECIAL_BONUS} on top of its usual one. ` +
    `At each of those, claim once: 2 random heroes of it worth ${FREYA.enhance.rewardGold.join('/')} gold together.`,
  innate: { enhance: FREYA.enhance },
  card: {
    name: 'Harvest Blessing',
    icon: '🎁',
    selfDesc: `Each reward you claim brings more: at 2, ${FREYA.cardGold} gold; at 4, an Equipment Chest; at 6, a random faction or role orb.`,
    self: { enhanceExtra: { gold: FREYA.cardGold } },
  },
  terms: {
    specialBonus: { icon: '🌸', title: 'Special Bonus', body: "<p>A blessed role's extra, at its 2 / 4 / 6.</p>" },
  },
};
