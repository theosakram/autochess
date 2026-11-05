import type { Opener } from '../effects';
import type { DamageType, StatKey, StatMod } from '../stats';

export type ItemKind = 'offense' | 'defense' | 'utility';

// Every `every` seconds the holder hits all enemies for `atkPct` of its attack.
export interface ItemPulse {
  every: number;
  atkPct: number;
  damageType: DamageType;
}

// While the holder is fielded, every member of trait `to` on its side gains `share` x the holder's
// highest of `from`, added to each of `stats`.
export interface ItemAura {
  to: string;
  from: StatKey[];
  stats: StatKey[];
  share: number;
}

// An item is data plus hooks, like a trait. Tiers start at 1.
export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  kind: ItemKind;
  trait: string; // works only while this trait is active for the holder's side
  maxTier: number;
  tierFromTrait?: boolean; // works at its trait's level instead of an upgradable tier
  forbidden?: string; // members of this trait can't hold it
  // One sentence for every tier; each {key} is filled from values(), one value per tier.
  desc: string;
  values(): Record<string, string[]>;
  mods(tier: number): StatMod[];
  pulse?(tier: number): ItemPulse;
  opener?(tier: number): Opener;
  aura?(tier: number): ItemAura;
  // The holder gets this trait's member bonuses without counting toward it; `icon` marks it.
  grantsMembership?: { trait: string; icon: string };
}
