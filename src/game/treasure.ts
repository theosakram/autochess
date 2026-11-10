import { powersOf } from './commanders';
import { POWER_TIERS } from './config';
import { biggestTrait, traitHeroes } from './cyclops';
import { giveChest, giveFactionOrb } from './powerCards';
import { nextInt } from './rng';
import { orbTraits, TRAITS } from './traits';
import type { GameState, Player, PowerTier } from './types';

// Zhu Yong (see commanders/zhuyong.ts): power card rounds raised a tier or two, and Black Dragon Treasures.

// A power card round's tier for this player: raised by Zhu Yong's power and card (they add up), capped at gold.
// `treasures`: the tiers raised past gold, each a Black Dragon Treasure if the player has the treasure power.
export function raisedTier(p: Player, tier: PowerTier): { tier: PowerTier; from?: PowerTier; treasures: number } {
  const pw = powersOf(p);
  const steps = (pw.tierUp ?? 0) + (pw.tierUpCard ?? 0);
  const at = POWER_TIERS.indexOf(tier);
  const top = POWER_TIERS.length - 1;
  const raised = POWER_TIERS[Math.min(top, at + steps)];
  return { tier: raised, from: raised !== tier ? tier : undefined, treasures: pw.treasure ? Math.max(0, at + steps - top) : 0 };
}

// Zhu Yong's treasure on its round (the commander card round).
export function treasureRound(state: GameState, p: Player): void {
  if (powersOf(p).treasure?.round === state.round) openTreasure(state, p);
}

// A Black Dragon Treasure: one prize at random. Returns what it gave, also kept on the player for the UI.
export function openTreasure(state: GameState, p: Player): string {
  const t = powersOf(p).treasure!;
  let text: string;
  switch (nextInt(state, 4)) {
    case 0: {
      // Factions and roles in one pile, as Prime Selection's (6-breakpoint traits only).
      const pile = orbTraits();
      const trait = pile[nextInt(state, pile.length)];
      giveFactionOrb(state, p, trait);
      text = `a ${TRAITS[trait].name} orb`;
      break;
    }
    case 1:
      p.gold += t.chestGold;
      giveChest(state, p);
      text = `an Equipment Chest + ${t.chestGold} gold`;
      break;
    case 2: {
      const trait = biggestTrait(state, p);
      const heroes = trait ? traitHeroes(state, p, trait, t.heroes) : [];
      if (heroes.length) text = `${heroes.length} ${TRAITS[trait!].name} heroes`;
      else {
        p.gold += t.gold; // nothing fielded, or the pool ran dry
        text = `${t.gold} gold`;
      }
      break;
    }
    default:
      p.gold += t.gold;
      text = `${t.gold} gold`;
  }
  (p.treasures ??= []).push(text);
  return text;
}
