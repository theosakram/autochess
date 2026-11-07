import { draw } from './altar';
import { powersOf } from './commanders';
import { SHOP_ODDS } from './config';
import { nextInt } from './rng';
import { playerTraitCounts } from './traits';
import type { GameState, Player, Tier } from './types';
import { UNIT_BY_ID, UNITS } from './units';

// Lunox's Twilight Blessing: handed out once: on picking Lunox (his innate power), or with his card on another
// commander (see commanders.payCommander / payCard). The player
// blesses one hero (that very unit, not its type): one of its own traits is rolled at random and the hero
// counts +1 toward it while fielded, stacking with the Magic Orb. Selling the hero loses the blessing; merging
// keeps it on the merged hero. Blessing also hands out heroes of the rolled trait (Lunox's own power).

// Why this unit can't be blessed, or null.
export function blessBlock(p: Player, uid: number): string | null {
  if (!powersOf(p).twilight || !p.twilight) return 'You have no Twilight Blessing';
  if (p.twilight.holder !== null) return 'The blessing has already been given';
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid);
  if (!unit) return 'No such unit';
  const def = UNIT_BY_ID[unit.defId];
  if (def.piece || def.traits.length === 0) return `The ${def.name} can't be blessed`;
  return null;
}

// Blesses unit `uid`: rolls its trait, queues the heroes. Returns an error, or null.
export function bless(state: GameState, p: Player, uid: number): string | null {
  const blocked = blessBlock(p, uid);
  if (blocked) return blocked;
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid)!;
  const traits = UNIT_BY_ID[unit.defId].traits;
  const trait = traits[nextInt(state, traits.length)];
  const gifts: string[] = [];
  for (let i = 0; i < powersOf(p).twilight!.heroes; i++) {
    const tier = giftTier(state, p, trait);
    const id = tier ? draw(state, tier, trait) : null;
    if (id) gifts.push(id);
  }
  (p.gifts ??= []).push(...gifts);
  p.twilight = { ...p.twilight!, holder: uid, trait, gifts };
  return null;
}

// A cost for one gifted hero of `trait`, rolled with the player's current shop odds among the costs that
// still have one of the trait in the pool. If the odds give none of those (e.g. only pricier ones are
// left at a low level), the cheapest of them. Null if the trait has none left at all.
function giftTier(state: GameState, p: Player, trait: string): Tier | null {
  const odds = SHOP_ODDS[p.level - 1];
  const tiers = ([1, 2, 3, 4, 5] as Tier[]).filter((t) => UNITS.some((u) => u.tier === t && u.shop !== false && !u.locked && u.traits.includes(trait) && (state.pool[u.id] ?? 0) > 0));
  if (!tiers.length) return null;
  const total = tiers.reduce((n, t) => n + odds[t - 1], 0);
  if (!total) return tiers[0];
  let r = nextInt(state, total);
  return tiers.find((t) => (r -= odds[t - 1]) < 0)!;
}

// The blessed hero, if the player still has it.
export const blessedUnit = (p: Player) => {
  const holder = p.twilight?.holder;
  return holder === null || holder === undefined ? null : ([...p.board, ...p.bench].find((u) => u?.uid === holder) ?? null);
};

// Lunox's card: the first time the blessed trait reaches its count, gold. Checked after every action and round.
export function payTwilight(p: Player): void {
  const rule = powersOf(p).twilightGold;
  const tw = p.twilight;
  if (!rule || !tw?.trait || tw.paid) return;
  if ((playerTraitCounts(p)[tw.trait] ?? 0) < rule.count) return;
  tw.paid = true;
  p.gold += rule.gold;
}
