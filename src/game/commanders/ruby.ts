import { redCloak } from '../items/redCloak';
import { scythe } from '../items/scythe';
import type { CommanderDef, SurvivorGoldPower } from './types';

// Tune with `bun run balance`.
export const RUBY = {
  survivorGold: { gold: 2, items: [redCloak.id, scythe.id], max: 35 } satisfies SurvivorGoldPower,
};

export const ruby: CommanderDef = {
  id: 'ruby',
  name: 'Ruby',
  icon: '🌹',
  title: 'Little Red Reaper',
  desc:
    `Gives you two pieces of equipment: the ${redCloak.icon} ${redCloak.name} and the ${scythe.icon} ${scythe.name}. ` +
    `The ${redCloak.name}'s wearer gets back up once a fight with 30% HP after dying, and marks enemies for the ${scythe.name} to hunt; ` +
    `when it gets back up, the ${scythe.name}'s wearer gains +55% attack and magic attack.`,
  innate: { startItems: [redCloak.id, scythe.id] },
  card: {
    name: "Hunter's Bounty",
    icon: '💵',
    selfDesc:
      `After every fight, +${RUBY.survivorGold.gold} gold for each ${redCloak.name} and ${scythe.name} wearer still standing at the end, ` +
      `up to ${RUBY.survivorGold.max} gold a game.`,
    self: { survivorGold: RUBY.survivorGold },
  },
};
