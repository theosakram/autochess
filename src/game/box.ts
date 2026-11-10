import { draw } from './altar';
import { STAGE_ONE_ROUNDS, STAGE_ROUNDS, stageRound } from './config';
import { EQUIPMENT } from './items';
import { isAlive } from './player';
import { shuffle } from './rng';
import { TRAITS } from './traits';
import type { Box, BoxPrize, GameState, Player, Tier } from './types';
import { UNIT_BY_ID } from './units';

// The Box round: after the last fight of every stage, everyone still in takes one prize from a shared box,
// one at a time, lowest hp first (the highest picks last). What isn't taken is gone (heroes go back to the pool).
export const BOX = {
  // Heroes by stage (index 0 = stage I; the last from then on): their costs.
  heroes: [
    [4, 4, 4],
    [4, 4, 5],
    [5, 5, 5],
  ] as Tier[][],
  capacity: 2, // +1 hero capacity, for good
  slots: 8, // items and faction/role orbs together
  orbs: [0, 1, 2, 3], // of those slots, orbs by stage (the last from then on)
};

// The last round of its stage.
export function isBoxRound(round: number): boolean {
  const { stage, sub } = stageRound(round);
  return sub === (stage === 1 ? STAGE_ONE_ROUNDS : STAGE_ROUNDS);
}

const byStage = <T>(list: T[], stage: number): T => list[Math.min(stage, list.length) - 1];

export function openBox(state: GameState): void {
  const alive = state.players.filter(isAlive);
  if (alive.length < 2) return;
  const stage = stageRound(state.round).stage;
  const heroes = byStage(BOX.heroes, stage).flatMap((tier): BoxPrize[] => {
    const defId = draw(state, tier, null);
    return defId ? [{ kind: 'hero', defId }] : [];
  });
  const orbCount = byStage(BOX.orbs, stage);
  const traits = Object.values(TRAITS).filter((t) => t.kind === 'faction' || t.kind === 'role').map((t) => t.id);
  const orbs = shuffle(state, traits).slice(0, orbCount).map((trait): BoxPrize => ({ kind: 'orb', trait }));
  const items = shuffle(state, [...EQUIPMENT]).slice(0, BOX.slots - orbCount).map((id): BoxPrize => ({ kind: 'item', id }));
  const caps = Array.from({ length: BOX.capacity }, (): BoxPrize => ({ kind: 'capacity' }));
  // Ties on hp in random order.
  const order = shuffle(state, alive).sort((a, b) => a.hp - b.hp).map((p) => p.id);
  state.box = { stage, prizes: [...heroes, ...caps, ...orbs, ...items], order, picks: [] };
  runBoxBots(state);
}

// Whose turn it is, or null once everyone has picked.
export const boxTurn = (box: Box): string | null => box.order[box.picks.length] ?? null;
// Who took prize `i`, if anyone.
export const takenBy = (box: Box, i: number): string | null => box.order[box.picks.indexOf(i)] ?? null;

export function pickBox(state: GameState, p: Player, i: number): string | null {
  const box = state.box;
  if (!box) return 'There is no box open';
  if (boxTurn(box) !== p.id) return "It isn't your turn";
  if (!Number.isInteger(i) || !box.prizes[i]) return 'No such prize';
  if (box.picks.includes(i)) return 'That one is taken';
  take(state, p, i);
  runBoxBots(state);
  return null;
}

function take(state: GameState, p: Player, i: number): void {
  const box = state.box!;
  box.picks.push(i);
  const prize = box.prizes[i];
  // A hero waits for bench room like any gift.
  if (prize.kind === 'hero') (p.gifts ??= []).push(prize.defId);
  else if (prize.kind === 'item') p.items.push({ uid: state.nextUid++, id: prize.id, tier: 1, holder: null });
  else if (prize.kind === 'orb') (p.mistOrbs ??= []).push({ uid: state.nextUid++, trait: prize.trait, holder: null });
  else p.boxCap = (p.boxCap ?? 0) + 1;
}

// Bots take their turns until it's a person's (or everyone has picked): capacity, then the dearest hero,
// then an orb, then an item.
function runBoxBots(state: GameState): void {
  const box = state.box!;
  for (let id = boxTurn(box); id; id = boxTurn(box)) {
    const p = state.players.find((x) => x.id === id)!;
    if (!p.isBot) return;
    const free = box.prizes.map((_, i) => i).filter((i) => !box.picks.includes(i));
    const score = (prize: BoxPrize) => (prize.kind === 'capacity' ? 100 : prize.kind === 'hero' ? 10 + UNIT_BY_ID[prize.defId].tier : prize.kind === 'orb' ? 5 : 1);
    take(state, p, free.reduce((best, i) => (score(box.prizes[i]) > score(box.prizes[best]) ? i : best)));
  }
}

// Everyone has picked (anyone left is picked for, so the game can go on): untaken heroes go back to the pool.
export function closeBox(state: GameState): void {
  const box = state.box;
  if (!box) return;
  for (let id = boxTurn(box); id; id = boxTurn(box)) {
    const p = state.players.find((x) => x.id === id)!;
    take(state, p, box.prizes.findIndex((_, i) => !box.picks.includes(i)));
  }
  box.prizes.forEach((prize, i) => {
    if (prize.kind === 'hero' && !box.picks.includes(i)) state.pool[prize.defId]++;
  });
  state.box = undefined;
}
