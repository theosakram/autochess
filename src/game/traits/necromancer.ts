import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const NECROMANCER = {
  perFight: [6, 18, 32], // souls after every fight, win or lose
  perDeployed: [1, 2, 3], // souls per unit on the board at the start of each round
  maxSouls: 999,
  skillAmp: 0.0005, // skill damage per soul, Necromancers only
  // The Plane Wanderers: one is rolled per player when their grave first appears, and stays theirs.
  wanderers: ['wanderingblade', 'wanderingeye', 'wanderinghunter', 'wanderingbastion', 'wanderingseer'],
  rewards: [
    { at: 100, star: 1 },
    { at: 350, star: 2 },
    { at: 999, star: 3 },
  ] as const,
};

export const necromancer: TraitDef = {
  id: 'necromancer',
  name: 'Necromancer',
  icon: '⚰️',
  kind: 'faction',
  breakpoints: [2, 4, 6],
  desc:
    'The grave gains {fight} souls after every fight and {deployed} per deployed unit at the start of every round ' +
    `(max ${NECROMANCER.maxSouls}). Necromancers deal +${+(NECROMANCER.skillAmp * 100).toFixed(2)}% skill damage per soul. ` +
    `At ${NECROMANCER.rewards.map((r) => r.at).join(' / ')} souls the grave raises your Plane Wanderer ` +
    `${NECROMANCER.rewards.map((r) => '★'.repeat(r.star)).join(' / ')}: one of five 5-gold heroes, rolled when your grave first appears. ` +
    'It takes no board slot and gets the Necromancer bonus without counting as one.',
  values: () => ({ fight: NECROMANCER.perFight.map(String), deployed: NECROMANCER.perDeployed.map(String) }),
  mods: ({ member, stacks }) => (member && stacks > 0 ? [{ stat: 'skillAmp', add: NECROMANCER.skillAmp * stacks }] : []),
  stacks: {
    label: 'Souls',
    max: NECROMANCER.maxSouls,
    perFight: (level) => NECROMANCER.perFight[level - 1],
    perRound: (level, deployed) => NECROMANCER.perDeployed[level - 1] * deployed,
    rewards: NECROMANCER.rewards.map((r) => ({ at: r.at, star: r.star })),
    rewardUnits: NECROMANCER.wanderers,
  },
};
