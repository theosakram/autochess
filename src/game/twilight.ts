import { draw } from './altar';
import { powersOf } from './commanders';
import { nextInt } from './rng';
import { playerTraitCounts } from './traits';
import type { GameState, Player, Tier } from './types';
import { UNIT_BY_ID, UNITS } from './units';

// Lunox's Twilight Blessing: handed out once, when the commander card is picked (see commanders.payCard). The player
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
    // 1 or 2 gold, at random among the costs that still have one of this trait in the pool.
    const tiers = ([1, 2] as Tier[]).filter((t) => UNITS.some((u) => u.tier === t && u.shop !== false && !u.locked && u.traits.includes(trait) && (state.pool[u.id] ?? 0) > 0));
    const pick = tiers.length ? tiers : ([1, 2] as Tier[]);
    const id = draw(state, pick[nextInt(state, pick.length)], trait);
    if (id) gifts.push(id);
  }
  (p.gifts ??= []).push(...gifts);
  p.twilight = { ...p.twilight!, holder: uid, trait, gifts };
  return null;
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
