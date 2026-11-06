import { BOARD_COLS, BOARD_ROWS } from './config';
import { UNIT_BY_ID } from './units';

// Default placement: melee centred from the front row backwards, ranged centred from the back row
// forwards. A row that's full spills into the next one. Returns one board cell per unit, in the order
// given (all different).
export function formation(defIds: string[]): number[] {
  const taken = new Set<number>();
  // Fills `count` cells across `rows` in order, each row centred on what goes into it.
  const fill = (count: number, rows: number[]): number[] => {
    const cells: number[] = [];
    for (const row of rows) {
      const free = Array.from({ length: BOARD_COLS }, (_, c) => row * BOARD_COLS + c).filter((cell) => !taken.has(cell));
      const n = Math.min(count - cells.length, free.length);
      if (n <= 0) continue;
      const start = Math.floor((free.length - n) / 2);
      for (const cell of free.slice(start, start + n)) {
        taken.add(cell);
        cells.push(cell);
      }
    }
    return cells;
  };
  const rows = Array.from({ length: BOARD_ROWS }, (_, r) => r);
  const isMelee = (d: string) => UNIT_BY_ID[d].range <= 1;
  const front = fill(defIds.filter(isMelee).length, rows);
  const back = fill(defIds.filter((d) => !isMelee(d)).length, [...rows].reverse());
  return defIds.map((d) => (isMelee(d) ? front.shift()! : back.shift()!));
}
