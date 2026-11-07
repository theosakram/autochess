import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Kenzo's own item. Tune with `bun run balance`.
export const BLACK_SASH = {
  hybridAtk: 0.6, // + share of attack and magic attack
  killsPerChest: 4, // the holder's own last hits (killing blows), across fights
  maxChests: 4,
};

export const blackSash: ItemDef = {
  id: 'blacksash',
  name: 'Black Sash',
  icon: '🥋',
  kind: 'offense',
  maxTier: 1,
  exclusive: true,
  desc:
    `+${pct(BLACK_SASH.hybridAtk)} attack and magic attack. ` +
    `Martial Arts (unique): every ${BLACK_SASH.killsPerChest} enemies the holder itself finishes off (last hits), across fights, earn an Equipment Chest ` +
    `(pick 1 of 3 equipment), up to ${BLACK_SASH.maxChests} chests a game.`,
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: BLACK_SASH.hybridAtk },
    { stat: 'ap', pct: BLACK_SASH.hybridAtk },
  ],
  chests: { kills: BLACK_SASH.killsPerChest, max: BLACK_SASH.maxChests },
};
