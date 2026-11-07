import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const STORYWEAVER = {
  eligibleTiers: [4], // who can be rolled as the game's protagonist
  perStack: [0.015, 0.03], // protagonist damage per story stack
  enhancedCast: [0.1, 2.5], // per level: the protagonist's skill damage bonus, real skills and the placeholder cast alike
  stacksPerFight: 3, // enemy deaths that count, per fight
  maxStacks: 30,
};

export const storyweaver: TraitDef = {
  id: 'storyweaver',
  name: 'Storyweaver',
  icon: '📜',
  kind: 'faction',
  breakpoints: [2, 4],
  desc:
    `At game start, one ${STORYWEAVER.eligibleTiers.join('/')}-gold Storyweaver becomes the protagonist for every player, all game. ` +
    'Fielded, its skill is enhanced (+{cast} skill damage) and it deals +{amp} damage per story. ' +
    `Every enemy death adds a story, up to ${STORYWEAVER.stacksPerFight} per fight and ${STORYWEAVER.maxStacks} total.`,
  values: () => ({ cast: STORYWEAVER.enhancedCast.map(pct), amp: STORYWEAVER.perStack.map(pct) }),
  chosen: { tiers: STORYWEAVER.eligibleTiers },
  stacks: { label: 'Stories', max: STORYWEAVER.maxStacks, perFight: (_, fight) => Math.min(STORYWEAVER.stacksPerFight, fight.kills) },
  mods: ({ level, chosen, stacks }) =>
    chosen
      ? [
          { stat: 'skillAmp', add: STORYWEAVER.enhancedCast[level - 1] },
          { stat: 'damageAmp', add: STORYWEAVER.perStack[level - 1] * stacks },
        ]
      : [],
};
