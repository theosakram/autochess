import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Kenzo's own item. Tune with `bun run balance`.
export const BLACK_SASH = {
  hybridAtk: 0.5, // + share of attack and magic attack
  killsPerChest: 4, // the holder's own last hits (killing blows), across fights
  maxChests: 4,
  attackSpeedEnhanced: 0.2, // enhanced: + attack speed
};

const text = (as = 0) =>
  `+${pct(BLACK_SASH.hybridAtk)} attack and magic attack${as ? `, +${pct(as)} attack speed` : ''}. ` +
  `Martial Arts (unique): every ${BLACK_SASH.killsPerChest} enemies the holder itself finishes off (last hits), across fights, earn an Equipment Chest ` +
  `(pick 1 of 3 equipment), up to ${BLACK_SASH.maxChests} chests a game.`;
const hybrid = [
  { stat: 'atk' as const, pct: BLACK_SASH.hybridAtk },
  { stat: 'ap' as const, pct: BLACK_SASH.hybridAtk },
];

export const blackSash: ItemDef = {
  id: 'blacksash',
  name: 'Black Sash',
  icon: '🥋',
  kind: 'offense',
  maxTier: 1,
  exclusive: true,
  desc: text(),
  values: () => ({}),
  mods: () => hybrid,
  chests: { kills: BLACK_SASH.killsPerChest, max: BLACK_SASH.maxChests },
  enhanced: { desc: text(BLACK_SASH.attackSpeedEnhanced), mods: () => [...hybrid, { stat: 'attackSpeed', add: BLACK_SASH.attackSpeedEnhanced }] },
};
