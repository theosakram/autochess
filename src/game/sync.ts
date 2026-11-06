import { syncItems } from './inventory';
import { mergeUnits } from './merge';
import { openMistShop, syncMistOrbs } from './mistShop';
import { nextInt } from './rng';
import { playerTraits, TRAITS } from './traits';
import type { GameState, Player } from './types';
import { UNIT_BY_ID } from './units';

// Run after anything that changes a player's units, and at round start: items, counters, rewards.
export function syncPlayer(state: GameState, p: Player): void {
  syncItems(state, p);
  // A counter appears (at 0) the first time its trait is active, and stays for the rest of the game.
  const levels = playerTraits(p);
  for (const id of Object.keys(levels)) {
    const rule = TRAITS[id].stacks;
    if (!rule) continue;
    if (p.stacks[id] === undefined) p.stacks[id] = 0;
    if (rule.fullAt && levels[id] >= rule.fullAt) p.stacks[id] = rule.max;
    if (p.rewardUnit?.[id]) continue;
    rewardUnit(state, p, id);
  }
  claimRewards(state, p);
  handlePromotions(state, p);
  if (p.board.some((u) => u && UNIT_BY_ID[u.defId].traits.includes('mistbender'))) openMistShop(state, p);
  syncMistOrbs(p);
}

// Lets active traits react to this player's merges (free units, unlocks), then hands out gifts.
// A gift can complete another merge, so this runs until nothing new happens.
export function handlePromotions(state: GameState, p: Player): void {
  for (let guard = 0; guard < 50; guard++) {
    const promotions = p.promotions ?? [];
    p.promotions = [];
    const levels = playerTraits(p);
    for (const { defId, star } of promotions) {
      const def = UNIT_BY_ID[defId];
      for (const [id, level] of Object.entries(levels)) {
        if (!def.traits.includes(id)) continue;
        const out = TRAITS[id].onPromote?.(level, def, star);
        if (out?.unlock && !(p.unlocked ??= []).includes(out.unlock)) p.unlocked.push(out.unlock);
        const options = (out?.gift ?? []).filter((g) => (state.pool[g] ?? 0) > 0);
        if (options.length) {
          const gift = options[nextInt(state, options.length)];
          state.pool[gift]--;
          (p.gifts ??= []).push(gift);
        }
      }
    }
    deliverGifts(state, p);
    if (!p.promotions?.length) return;
  }
}

// Waiting free units go to the bench while there's room, merging as they land.
function deliverGifts(state: GameState, p: Player): void {
  while (p.gifts?.length && p.bench.includes(null)) {
    const defId = p.gifts.shift()!;
    p.bench[p.bench.indexOf(null)] = { uid: state.nextUid++, defId, star: 1 };
    mergeUnits(p, defId);
  }
}

// This player's reward unit for a trait: rolled once from its options (when its counter first
// appears), then the same all game, whatever happens to the units.
function rewardUnit(state: GameState, p: Player, id: string): string | undefined {
  const options = TRAITS[id].stacks?.rewardUnits;
  if (!options?.length) return undefined;
  return ((p.rewardUnit ??= {})[id] ??= options[nextInt(state, options.length)]);
}

// Hands out every stack reward reached, in order. One that can't fit (full bench) waits for a later sync.
export function claimRewards(state: GameState, p: Player): void {
  for (const [id, stacks] of Object.entries(p.stacks)) {
    const rewards = TRAITS[id].stacks?.rewards ?? [];
    p.rewards ??= {};
    let claimed = p.rewards[id] ?? 0;
    const unit = rewardUnit(state, p, id);
    while (unit && claimed < rewards.length && stacks >= rewards[claimed].at && grant(state, p, { unit, star: rewards[claimed].star })) claimed++;
    if (claimed) p.rewards[id] = claimed;
  }
}

// Raises the player's best copy of the unit to `star`, or gives a new one on the bench.
function grant(state: GameState, p: Player, r: { unit: string; star: 1 | 2 | 3 }): boolean {
  const owned = [...p.board, ...p.bench].filter((u) => u?.defId === r.unit).sort((a, b) => b!.star - a!.star)[0];
  if (owned) {
    if (owned.star < r.star) owned.star = r.star;
    return true;
  }
  const free = p.bench.indexOf(null);
  if (free < 0) return false;
  p.bench[free] = { uid: state.nextUid++, defId: r.unit, star: r.star };
  return true;
}
