import { BOARD_COLS, BOARD_ROWS } from '../config';
import { pct } from './format';
import type { TraitDef } from './types';

const cell = (row: number, col: number) => row * BOARD_COLS + col;
const ALL_CELLS = Array.from({ length: BOARD_COLS * BOARD_ROWS }, (_, i) => i);

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const DRAGON_ALTAR = {
  // Board cells (row 0 = front line) that become altars.
  tiles: [
    [cell(0, 2), cell(0, 4), cell(2, 2), cell(2, 4)],
    [cell(0, 2), cell(0, 4), cell(1, 1), cell(1, 5), cell(2, 2), cell(2, 4)],
    ALL_CELLS,
    ALL_CELLS,
  ],
  bonus: [0.075, 0.15, 0.225, 1], // hp, attack and magic attack for allies starting on an altar
  memberMult: 3, // Dragon Altar units get this many times the bonus
};

export const dragonAltar: TraitDef = {
  id: 'dragonaltar',
  name: 'Dragon Altar',
  icon: '🐉',
  kind: 'faction',
  breakpoints: [2, 4, 6, 10],
  tiles: (level) => DRAGON_ALTAR.tiles[level - 1],
  desc: 'Altar tiles: {tiles}. Allies starting on an altar get +{bonus} HP and both attacks, Dragon Altar units +{member}.',
  values: () => ({
    tiles: DRAGON_ALTAR.tiles.map((t) => (t.length === ALL_CELLS.length ? 'all' : String(t.length))),
    bonus: DRAGON_ALTAR.bonus.map(pct),
    member: DRAGON_ALTAR.bonus.map((b) => pct(b * DRAGON_ALTAR.memberMult)),
  }),
  mods: ({ level, member, cell }) => {
    if (!DRAGON_ALTAR.tiles[level - 1].includes(cell)) return [];
    const bonus = DRAGON_ALTAR.bonus[level - 1] * (member ? DRAGON_ALTAR.memberMult : 1);
    return [
      { stat: 'hp', pct: bonus },
      { stat: 'atk', pct: bonus },
      { stat: 'ap', pct: bonus },
    ];
  },
};
