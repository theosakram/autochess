import type { CommanderDef } from './types';

// Tune with `bun run commanders`. Each Enhancement Charge also pays gold and XP (see enhancer.ts).
export const MINOS = {
  startChests: 1,
  enhancers: 3, // Enhancement Charges, from the start
  card: { equipment: 2, enhancers: 2 }, // random equipment straight to the inventory, and more charges (on top)
};

export const minos: CommanderDef = {
  id: 'minos',
  name: 'Minos',
  icon: '🐂',
  title: 'Forgemaster of the Labyrinth',
  desc:
    `Start with ${MINOS.startChests} Equipment Chest and ${MINOS.enhancers} Enhancement Charges: each turns one of your items into its ` +
    'enhanced version, and gives 3 gold and 3 XP.',
  innate: { startChests: MINOS.startChests, startEnhancers: MINOS.enhancers },
  card: {
    name: 'Labyrinth Forge',
    icon: '🔥',
    selfDesc:
      `Gain ${MINOS.card.equipment} random equipment, straight to your inventory, and ${MINOS.card.enhancers} more Enhancement Charges ` +
      `(on top of your ${MINOS.enhancers}).`,
    self: { pickEquipment: MINOS.card.equipment, startEnhancers: MINOS.card.enhancers },
  },
};
