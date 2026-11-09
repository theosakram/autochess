import { pct } from '../traits/format';
import { supremeBlade } from '../items/supremeBlade';
import type { CommanderDef } from './types';

// Tune with `bun run commanders`.
export const KATARINA = {
  card: { gold: 6, attackSpeed: 0.4 }, // her own card: gold, and the Supreme Blade's holder attacks faster
};

export const katarina: CommanderDef = {
  id: 'katarina',
  name: 'Katarina',
  icon: '🔪',
  title: 'Sinister Blade',
  desc:
    `Gives you her ${supremeBlade.icon} ${supremeBlade.name}: +35% attack and magic attack, +25% max HP. Its holder executes enemies next to it ` +
    'under 18% HP, and every execution adds +2% damage to the blade for good (up to +36%).',
  innate: { startItems: [supremeBlade.id] },
  card: {
    name: 'Death Lotus',
    icon: '🌸',
    selfDesc: `Gain ${KATARINA.card.gold} gold. The ${supremeBlade.name}'s holder gains +${pct(KATARINA.card.attackSpeed)} attack speed.`,
    self: { pickGold: KATARINA.card.gold, itemBoost: { item: supremeBlade.id, mods: [{ stat: 'attackSpeed', add: KATARINA.card.attackSpeed }] } },
    otherDesc: `Gain her ${supremeBlade.icon} ${supremeBlade.name}: +35% attack and magic attack, +25% max HP; its holder executes enemies next to it under 18% HP, and every execution adds +2% damage to the blade for good (up to +36%).`,
    other: { startItems: [supremeBlade.id] },
  },
};
