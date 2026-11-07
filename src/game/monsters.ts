import { BOARD_COLS, BOARD_ROWS, CREEP_ROUND, isEquipmentRound, stageOf } from './config';
import { formation } from './formation';
import type { Player, Star, Unit } from './types';

// The monsters' side in a monster round. Not a player: it's never in GameState.players.
export const MONSTER_ID = 'monsters';

// Lineups by monster round: I-1's creeps, then II-3, III-3, IV-3; later ones repeat the last, stronger each time.
export const MONSTER_LINEUPS: { defId: string; star: Star }[][] = [
  // I-1: a pair of young wolves (toned down, see CREEP_MULT), against your free starting heroes.
  [
    { defId: 'mistwolf', star: 1 },
    { defId: 'mistwolf', star: 1 },
  ],
  // II-3: a wolf pack.
  [
    { defId: 'mistwolf', star: 1 },
    { defId: 'mistwolf', star: 1 },
    { defId: 'mistwolf', star: 2 },
    { defId: 'mistwolf', star: 1 },
    { defId: 'mistwolf', star: 1 },
  ],
  // III-3: golems holding the line for the pack.
  [
    { defId: 'stonegolem', star: 2 },
    { defId: 'stonegolem', star: 2 },
    { defId: 'mistwolf', star: 2 },
    { defId: 'mistwolf', star: 2 },
    { defId: 'mistwolf', star: 2 },
  ],
  // IV-3: the Elder Drake and its guard.
  [
    { defId: 'elderdrake', star: 2 },
    { defId: 'stonegolem', star: 2 },
    { defId: 'stonegolem', star: 2 },
    { defId: 'mistwolf', star: 3 },
    { defId: 'mistwolf', star: 3 },
    { defId: 'mistwolf', star: 2 },
  ],
];
// Each monster round past the last lineup: this much more hp and attack, stacking.
export const MONSTER_SCALING = 0.25;
// I-1's creeps fight at this share of their hp and attack.
export const CREEP_MULT = 0.5;

// Which monster round this is (0 for I-1's creeps, 1 for II-3, 2 for III-3, ...), or -1 if it isn't one.
export const monsterIndex = (round: number) => (round === CREEP_ROUND ? 0 : isEquipmentRound(round) ? stageOf(round) - 1 : -1);

// The monsters for this round, placed like a player's board, plus their stat multiplier.
export function monsterSide(round: number): { player: Player; statMult: number } {
  const k = monsterIndex(round);
  const last = MONSTER_LINEUPS.length - 1;
  const lineup = MONSTER_LINEUPS[Math.min(k, last)];
  const board: (Unit | null)[] = Array(BOARD_COLS * BOARD_ROWS).fill(null);
  formation(lineup.map((m) => m.defId)).forEach((cell, i) => (board[cell] = { uid: -1 - i, defId: lineup[i].defId, star: lineup[i].star }));
  const player: Player = {
    id: MONSTER_ID,
    name: 'Monsters',
    isBot: true,
    hp: 1,
    gold: 0,
    level: lineup.length,
    xp: 0,
    bench: [],
    board,
    shop: [],
    shopLocked: false,
    place: null,
    stacks: {},
    items: [],
    orbs: [],
    orb: null,
    commander: null,
  };
  return { player, statMult: k === 0 ? CREEP_MULT : 1 + MONSTER_SCALING * Math.max(0, k - last) };
}
