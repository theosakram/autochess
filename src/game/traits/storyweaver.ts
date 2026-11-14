import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const STORYWEAVER = {
  eligibleTiers: [4], // who can be rolled as the game's protagonist
  perStack: [0.015, 0.03], // damage per story stack, every Storyweaver (any cost)
  stacksPerFight: 3, // enemy deaths that count, per fight
  maxStacks: 30,
};

export const storyweaver: TraitDef = {
  id: 'storyweaver',
  name: 'Storyweaver',
  kind: 'faction',
  breakpoints: [2, 4],
  desc:
    `At game start, one ${STORYWEAVER.eligibleTiers.join('/')}-gold Storyweaver becomes the protagonist for every player, all game. ` +
    'Fielded, it casts its enhanced skill (see its skill). Every Storyweaver deals +{amp} damage per story. ' +
    `Every enemy death adds a story, up to ${STORYWEAVER.stacksPerFight} per fight and ${STORYWEAVER.maxStacks} total.`,
  values: () => ({ amp: STORYWEAVER.perStack.map(pct) }),
  chosen: { tiers: STORYWEAVER.eligibleTiers },
  stacks: { label: 'Stories', max: STORYWEAVER.maxStacks, perFight: (_, fight) => Math.min(STORYWEAVER.stacksPerFight, fight.kills) },
  // The protagonist's enhanced skill lives in its own skill (Tale's End, Myth Made Flesh), keyed on `chosen`.
  mods: ({ level, member, stacks }) =>
    member && stacks ? [{ stat: 'damageAmp', add: STORYWEAVER.perStack[level - 1] * stacks }] : [],
};
