import { pct } from './format';
import type { TraitDef } from './types';
import { UNITS } from '../units';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const SPECTRE = {
  damageAmp: [0.2, 0.4, 0.6, 4], // Spectres only
  hp: [0, 0, 0, 4], // Spectres only
  // Two-starring a Spectre of these costs conjures a free Spectre one cost up (cumulative by level).
  giftTiers: [[1, 2], [3, 4], [5], []] as number[][],
  boss: 'bossalpha', // the 7-gold Spectre: unlocked and gifted by two-starring the 5-gold one at level 3+
  bossStars: [0, 0, 0, 1], // extra stars Boss Alpha fights at
};

const spectres = () => UNITS.filter((u) => u.traits.includes('spectre'));

export const spectre: TraitDef = {
  id: 'spectre',
  name: 'Spectre',
  icon: '👻',
  kind: 'faction',
  breakpoints: [2, 4, 6, 10],
  desc:
    'Spectres deal +{amp} damage. Two-starring a Spectre of up to {gift} gold conjures a free Spectre one cost higher. ' +
    'At 6, two-starring the 5-gold Spectre also puts the 7-gold Boss Alpha in your shop for the rest of the game and gives you one. ' +
    `At 10, Spectres gain +${pct(SPECTRE.hp[3])} HP and Boss Alpha fights one star higher.`,
  values: () => ({
    amp: SPECTRE.damageAmp.map(pct),
    gift: [1, 2, 3, 4].map((lvl) => String(Math.max(...SPECTRE.giftTiers.slice(0, lvl).flat()))),
  }),
  mods: ({ level, member }) =>
    member
      ? [
          { stat: 'damageAmp', add: SPECTRE.damageAmp[level - 1] },
          ...(SPECTRE.hp[level - 1] ? [{ stat: 'hp' as const, pct: SPECTRE.hp[level - 1] }] : []),
        ]
      : [],
  onPromote(level, def, star) {
    if (star !== 2 || !SPECTRE.giftTiers.slice(0, level).flat().includes(def.tier)) return null;
    if (def.tier === 5) return { unlock: SPECTRE.boss, gift: [SPECTRE.boss] };
    const higher = spectres().filter((u) => u.tier > def.tier && u.tier < 7);
    const next = Math.min(...higher.map((u) => u.tier));
    return { gift: higher.filter((u) => u.tier === next).map((u) => u.id) };
  },
  starBonus: (level, def) => (def.id === SPECTRE.boss ? SPECTRE.bossStars[level - 1] : 0),
};
