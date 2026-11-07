import { rewardText } from './format';
import type { StackReward, TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const NECROMANCER = {
  perFight: [6, 18, 25, 25], // souls after every fight, win or lose
  perDeployed: [1, 2, 3, 3], // souls per unit on the board at the start of each round
  fullAt: 4, // level (Necromancer 10) at which the grave fills to the max at once
  goldPerRound: [0, 0, 0, 5], // extra gold at the start of every round
  maxSouls: 999,
  skillAmp: 0.0003, // skill damage per soul, Necromancers only
  hp: 0.0003, // max hp per soul, Necromancers only
  // The Plane Wanderers: one is rolled per player when their grave first appears, and stays theirs.
  wanderers: ['wanderingblade', 'wanderingeye', 'wanderinghunter', 'wanderingbastion', 'wanderingseer'],
  // The Plane Wanderer at 100 / 350 / 999 souls, with gold, equipment and an orb in between.
  rewards: [
    { at: 100, star: 1 },
    { at: 200, gold: 10 },
    { at: 350, star: 2 },
    { at: 400, equipment: 1 },
    { at: 600, orbs: 1 },
    { at: 999, star: 3 },
  ] as StackReward[],
};

export const necromancer: TraitDef = {
  id: 'necromancer',
  name: 'Necromancer',
  icon: '⚰️',
  kind: 'faction',
  breakpoints: [2, 4, 6, 10],
  desc:
    'The grave gains {fight} souls after every fight and {deployed} per deployed unit at the start of every round ' +
    `(max ${NECROMANCER.maxSouls}). Necromancers gain +${+(NECROMANCER.skillAmp * 100).toFixed(2)}% skill damage and +${+(NECROMANCER.hp * 100).toFixed(2)}% max HP per soul. ` +
    `The grave's rewards: ${NECROMANCER.rewards.map((r) => `${r.at}: ${rewardText(r, 'your Plane Wanderer')}`).join(', ')}. ` +
    'Your Plane Wanderer is one of five 5-gold heroes, rolled when your grave first appears. ' +
    'It takes no board slot and gets the Necromancer bonus without counting as one. ' +
    `At 10, the grave fills to ${NECROMANCER.maxSouls} at once and you gain {gold} gold at the start of every round.`,
  values: () => ({
    fight: NECROMANCER.perFight.map(String),
    deployed: NECROMANCER.perDeployed.map(String),
    gold: NECROMANCER.goldPerRound.map((g) => (g ? `+${g}` : '-')),
  }),
  roundStart: (level) => (NECROMANCER.goldPerRound[level - 1] ? { gold: NECROMANCER.goldPerRound[level - 1] } : undefined),
  mods: ({ member, stacks }) =>
    member && stacks > 0
      ? [
          { stat: 'skillAmp', add: NECROMANCER.skillAmp * stacks },
          { stat: 'hp', pct: NECROMANCER.hp * stacks },
        ]
      : [],
  stacks: {
    label: 'Souls',
    max: NECROMANCER.maxSouls,
    perFight: (level) => NECROMANCER.perFight[level - 1],
    perRound: (level, deployed) => NECROMANCER.perDeployed[level - 1] * deployed,
    rewards: NECROMANCER.rewards,
    rewardUnits: NECROMANCER.wanderers,
    fullAt: NECROMANCER.fullAt,
  },
};
