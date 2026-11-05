import { BOARD_COLS, BOARD_ROWS } from './config';
import { UNIT_BY_ID } from './units';

// Default placement: melee centred on the front row, ranged centred on the back row.
// Returns one board cell per unit, in the order given.
export function formation(defIds: string[]): number[] {
  const rowCells = (count: number, row: number) => {
    const start = Math.floor((BOARD_COLS - count) / 2);
    return Array.from({ length: count }, (_, i) => row * BOARD_COLS + start + i);
  };
  const isMelee = (d: string) => UNIT_BY_ID[d].range <= 1;
  const front = rowCells(defIds.filter(isMelee).length, 0);
  const back = rowCells(defIds.filter((d) => !isMelee(d)).length, BOARD_ROWS - 1);
  return defIds.map((d) => (isMelee(d) ? front.shift()! : back.shift()!));
}
