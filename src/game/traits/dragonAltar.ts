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
  // Hp, attack and magic attack for units starting on an altar: other allies, and Dragon Altar units.
  allyBonus: [0.03, 0.06, 0.1, 1],
  memberBonus: [0.15, 0.3, 0.5, 2],
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
    bonus: DRAGON_ALTAR.allyBonus.map(pct),
    member: DRAGON_ALTAR.memberBonus.map(pct),
  }),
  mods: ({ level, member, cell }) => {
    if (!DRAGON_ALTAR.tiles[level - 1].includes(cell)) return [];
    const bonus = (member ? DRAGON_ALTAR.memberBonus : DRAGON_ALTAR.allyBonus)[level - 1];
    return [
      { stat: 'hp', pct: bonus },
      { stat: 'atk', pct: bonus },
      { stat: 'ap', pct: bonus },
    ];
  },
};
