import { payTwilight } from './twilight';
import { syncBeast, syncMarks } from './commanders';
import { syncItems } from './inventory';
import { EQUIPMENT } from './items';
import { syncJohnnie } from './johnnie';
import { onTwoStar, syncMirrorBar } from './mirrorBar';
import { mergeUnits } from './merge';
import { openMistShop, syncMistOrbs } from './mistShop';
import { nextInt } from './rng';
import { giveTwoStar } from './actions';
import { allyCall, checkChestTriggers, deliverSignatures, deliverTurrets, starGiftOf, syncRift } from './powerCards';
import { playerTraits, TRAITS } from './traits';
import type { GameState, Player } from './types';
import type { StackReward } from './traits/types';
import { UNIT_BY_ID } from './units';
import { syncRitual } from './ritual';

// Run after anything that changes a player's units, and at round start: items, counters, rewards.
export function syncPlayer(state: GameState, p: Player): void {
  syncBeast(state, p);
  syncJohnnie(state, p);
  syncMirrorBar(p);
  payTwilight(p);
  syncMarks(p);
  syncRitual(state, p); // Moscow: the altar names its heroes
  syncItems(state, p);
  checkChestTriggers(state, p); // Counter Action, Apex Weaponry, Trust Fund, Neon Zenith
  syncRift(state, p); // Emergency Rift
  deliverSignatures(state, p); // hero cards
  deliverTurrets(state, p); // Turret of Guardians
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

// Lets traits react to this player's merges (free units, unlocks), then hands out gifts. A merge the trait
// would reward only at a higher level than it has now waits (promotionsWaiting) and is paid once the trait gets
// there, if the hero is still owned at that star: two-star a 3-gold Spectre at 2 Spectres, reach 4, get the gift.
// A gift can complete another merge, so this runs until nothing new happens.
export function handlePromotions(state: GameState, p: Player): void {
  for (let guard = 0; guard < 50; guard++) {
    const promotions = p.promotions ?? [];
    p.promotions = [];
    const levels = playerTraits(p);
    for (const { defId, star } of promotions) {
      if (star === 2) onTwoStar(p);
      if (star === 3 && starGiftOf(p)) giveTwoStar(state, p, defId);
      allyCall(state, p, defId); // Ally's Call
      for (const id of UNIT_BY_ID[defId].traits) {
        const trait = TRAITS[id];
        if (!trait?.onPromote) continue;
        const out = trait.onPromote(levels[id] ?? 0, UNIT_BY_ID[defId], star);
        if (out) payPromotion(state, p, out);
        else if (trait.onPromote(trait.breakpoints.length, UNIT_BY_ID[defId], star)) (p.promotionsWaiting ??= []).push({ trait: id, defId, star });
      }
    }
    payWaiting(state, p, levels);
    deliverGifts(state, p);
    if (!p.promotions?.length) return;
  }
}

// What a trait hands out for a merge: an unlock, and one of its gifts still in the pool.
function payPromotion(state: GameState, p: Player, out: { gift?: string[]; unlock?: string }): void {
  if (out.unlock && !(p.unlocked ??= []).includes(out.unlock)) p.unlocked.push(out.unlock);
  const options = (out.gift ?? []).filter((g) => (state.pool[g] ?? 0) > 0);
  if (!options.length) return;
  const gift = options[nextInt(state, options.length)];
  state.pool[gift]--;
  (p.gifts ??= []).push(gift);
}

// Waiting merges whose trait has now reached a level that rewards them. One whose hero is gone (sold, or no
// copy left at that star) is dropped.
function payWaiting(state: GameState, p: Player, levels: Record<string, number>): void {
  if (!p.promotionsWaiting?.length) return;
  const owned = (defId: string, star: number) => [...p.board, ...p.bench].some((u) => u?.defId === defId && u.star >= star);
  p.promotionsWaiting = p.promotionsWaiting.filter(({ trait, defId, star }) => {
    if (!owned(defId, star)) return false;
    const out = TRAITS[trait].onPromote!(levels[trait] ?? 0, UNIT_BY_ID[defId], star);
    if (!out) return true;
    payPromotion(state, p, out);
    return false;
  });
  if (!p.promotionsWaiting.length) p.promotionsWaiting = undefined;
}

// Waiting free units go to the bench while there's room, merging as they land.
function deliverGifts(state: GameState, p: Player): void {
  while (p.gifts?.length && p.bench.includes(null)) {
    const defId = p.gifts.shift()!;
    p.bench[p.bench.indexOf(null)] = { uid: state.nextUid++, defId, star: 1 };
    mergeUnits(p, defId);
  }
}

// This player's reward unit for a trait, the same all game once set, whatever happens to the units. With
// `rewardChoices` > 1, that many different options are rolled once (when its counter first appears) and the
// player picks one (pickReward); until then there's none, and its unit rewards wait.
export function rewardUnit(state: GameState, p: Player, id: string): string | undefined {
  const rule = TRAITS[id].stacks;
  const options = rule?.rewardUnits;
  if (!options?.length) return undefined;
  if (p.rewardUnit?.[id]) return p.rewardUnit[id];
  const choices = Math.min(rule!.rewardChoices ?? 1, options.length);
  if (choices <= 1) return ((p.rewardUnit ??= {})[id] = options[nextInt(state, options.length)]);
  if (!p.rewardOffer?.[id]) {
    const left = options.slice();
    (p.rewardOffer ??= {})[id] = Array.from({ length: choices }, () => left.splice(nextInt(state, left.length), 1)[0]);
  }
  return undefined;
}

// Why the player can't take `unit` as their reward unit for trait `id`, or null.
export function rewardPickBlock(p: Player, id: string, unit: string): string | null {
  if (p.rewardUnit?.[id]) return 'Already chosen';
  if (!p.rewardOffer?.[id]?.includes(unit)) return 'Not on offer';
  return null;
}

// Picks one of the offered reward units (its waiting rewards are claimed on the sync after).
export function pickReward(p: Player, id: string, unit: string): string | null {
  const err = rewardPickBlock(p, id, unit);
  if (err) return err;
  (p.rewardUnit ??= {})[id] = unit;
  delete p.rewardOffer![id];
  if (!Object.keys(p.rewardOffer!).length) p.rewardOffer = undefined;
  return null;
}

// Hands out every stack reward reached, in order. One that can't fit (full bench) waits for a later sync.
export function claimRewards(state: GameState, p: Player): void {
  for (const [id, stacks] of Object.entries(p.stacks)) {
    const rewards = TRAITS[id].stacks?.rewards ?? [];
    p.rewards ??= {};
    let claimed = p.rewards[id] ?? 0;
    const unit = rewardUnit(state, p, id);
    // In order; a unit reward waits for bench room (and holds up the ones after it).
    while (claimed < rewards.length && stacks >= rewards[claimed].at && payReward(state, p, rewards[claimed], unit)) claimed++;
    if (claimed) p.rewards[id] = claimed;
  }
}

// Raises the player's best copy of the unit to `star`, or gives a new one on the bench.
// Pays one milestone reward; false if it can't be paid yet (a unit with no room for it).
function payReward(state: GameState, p: Player, r: StackReward, unit: string | undefined): boolean {
  if ('star' in r) return !!unit && grant(state, p, { unit, star: r.star });
  if ('gold' in r) p.gold += r.gold;
  else if ('equipment' in r) {
    for (let k = 0; k < r.equipment; k++) p.items.push({ uid: state.nextUid++, id: EQUIPMENT[nextInt(state, EQUIPMENT.length)], tier: 1, holder: null });
  } else for (let k = 0; k < r.orbs; k++) p.orbs.push(nextInt(state, 2 ** 30));
  return true;
}

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
