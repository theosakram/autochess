import { canClaimToBoard, gainUnit, giveTwoStar } from './actions';
import { powersOf } from './commanders';
import type { DemonAltarPower } from './commanders';
import { CHEST_OFFER, POWER_TIERS } from './config';
import { canEnhance, EQUIPMENT, enhancedId } from './items';
import { openChest } from './inventory';
import { addXp } from './player';
import { giveChest, giveFactionOrb } from './powerCards';
import { nextInt, shuffle } from './rng';
import { drawFromTier } from './shop';
import { orbTraits } from './traits';
import type { GameState, Player, PowerTier } from './types';
import { UNIT_BY_ID } from './units';

// Dracula (see commanders/dracula.ts): Demon Altars, each holding 6 rewards (2 blue, 2 purple, 2 gold) rolled when
// it's summoned. An activation (one per round of the altar's, banked) discards a reward of the player's choice and
// pays one of the rest at random; both leave the altar, so 3 activations empty it.

export type DemonAltarKey = 'demonAltar' | 'demonAltarCard';
export const DEMON_ALTAR_KEYS: DemonAltarKey[] = ['demonAltar', 'demonAltarCard'];

export interface AltarReward {
  id: string;
  tier: PowerTier;
  name: string;
  kind: string; // its icon (ui/icons/altarRewards.ts)
  short: string; // the label on its tile
  give(state: GameState, p: Player): string; // what it gave
}

// `n` random heroes of cost `cost` from the pool, to the bench (else the board). One with no room, or none left
// in the pool, pays its cost in gold instead.
const heroes = (cost: number, n: number, tier: PowerTier): AltarReward => ({
  id: `hero${cost}x${n}`,
  tier,
  name: `${n} random ${cost}-gold heroes`,
  kind: `hero${cost}`,
  short: `${n}× ${cost}g hero`,
  give(state, p) {
    const got: string[] = [];
    let gold = 0;
    for (let k = 0; k < n; k++) {
      const id = drawFromTier(state, cost, p);
      if (id && canClaimToBoard(p, id)) {
        gainUnit(state, p, id, true);
        got.push(UNIT_BY_ID[id].name);
      } else {
        if (id) state.pool[id]++;
        gold += cost;
      }
    }
    p.gold += gold;
    return [got.join(', '), gold ? `${gold} gold` : ''].filter(Boolean).join(' + ');
  },
});

const gold = (n: number, tier: PowerTier): AltarReward => ({
  id: `gold${n}`,
  tier,
  name: `${n} gold`,
  kind: 'gold',
  short: `${n} gold`,
  give(_state, p) {
    p.gold += n;
    return `${n} gold`;
  },
});

const xp = (n: number, tier: PowerTier): AltarReward => ({
  id: `xp${n}`,
  tier,
  name: `${n} XP`,
  kind: 'xp',
  short: `${n} XP`,
  give(_state, p) {
    addXp(p, n);
    return `${n} XP`;
  },
});

// Choose one of 3 orbs of the kind (a random one of them if another orb pick is still waiting).
const orb = (kind: 'faction' | 'role'): AltarReward => ({
  id: `${kind}Orb`,
  tier: 'gold',
  name: `${kind === 'faction' ? 'Faction' : 'Role'} orb (choose 1 of 3)`,
  kind: `${kind}Orb`,
  short: `${kind === 'faction' ? 'Faction' : 'Role'} orb`,
  give(state, p) {
    const offer = shuffle(state, orbTraits(kind)).slice(0, 3);
    if (p.factionOrbOffer?.length) giveFactionOrb(state, p, offer[0]);
    else p.factionOrbOffer = offer;
    return `a ${kind} orb`;
  },
});

export const ALTAR_REWARDS: Record<PowerTier, AltarReward[]> = {
  blue: [
    gold(6, 'blue'),
    xp(7, 'blue'),
    heroes(2, 2, 'blue'),
    {
      id: 'star1',
      tier: 'blue',
      name: 'A random 2★ 1-gold hero',
      kind: 'star',
      short: '2★ 1g hero',
      give(state, p) {
        const defs = Object.values(UNIT_BY_ID).filter((u) => u.tier === 1 && u.shop !== false && !u.locked && !u.piece);
        const def = defs[nextInt(state, defs.length)];
        if (!p.bench.includes(null) && !p.board.includes(null)) {
          p.gold += 3;
          return '3 gold (no room for the hero)';
        }
        giveTwoStar(state, p, def.id);
        return `a 2★ ${def.name}`;
      },
    },
    heroes(1, 4, 'blue'),
    {
      id: 'chest',
      tier: 'blue',
      name: 'An Equipment Chest',
      kind: 'chest',
      short: 'Chest',
      give(state, p) {
        giveChest(state, p);
        return 'an Equipment Chest';
      },
    },
  ],
  purple: [
    gold(10, 'purple'),
    xp(12, 'purple'),
    heroes(3, 3, 'purple'),
    heroes(4, 2, 'purple'),
    {
      id: 'enhancedChest',
      tier: 'purple',
      name: 'An Enhanced Equipment Chest',
      kind: 'enhancedChest',
      short: 'Enhanced chest',
      give(state, p) {
        p.enhancedChests = (p.enhancedChests ?? 0) + 1;
        openChest(state, p);
        return 'an Enhanced Equipment Chest';
      },
    },
  ],
  gold: [
    gold(15, 'gold'),
    orb('faction'),
    orb('role'),
    heroes(5, 2, 'gold'),
    {
      id: 'mirror',
      tier: 'gold',
      name: 'A Mirror Device',
      kind: 'mirror',
      short: 'Mirror Device',
      give(_state, p) {
        p.mirrors = (p.mirrors ?? 0) + 1;
        return 'a Mirror Device';
      },
    },
  ],
};
export const ALTAR_REWARD_BY_ID: Record<string, AltarReward> = Object.fromEntries(
  Object.values(ALTAR_REWARDS).flatMap((list) => list.map((r) => [r.id, r])),
);

// An Enhanced Equipment Chest's offer: enhanced versions of random equipment.
export const enhancedChestOffer = (state: GameState): string[] =>
  shuffle(state, EQUIPMENT.filter(canEnhance)).slice(0, CHEST_OFFER).map(enhancedId);

const powerOf = (p: Player, key: DemonAltarKey): DemonAltarPower | undefined => powersOf(p)[key];

// Summons the altars the player's powers grant, each with its 6 rewards (2 of each tier, no repeats).
export function summonAltars(state: GameState, p: Player): void {
  for (const key of DEMON_ALTAR_KEYS) {
    if (!powerOf(p, key) || p.demonAltars?.[key]) continue;
    const rewards = POWER_TIERS.flatMap((tier) => shuffle(state, ALTAR_REWARDS[tier].map((r) => r.id)).slice(0, 2));
    (p.demonAltars ??= {})[key] = { rewards, used: 0 };
  }
}

// Activations banked: one for each of the altar's rounds reached, less those used (none once it's empty).
export function altarCharges(round: number, p: Player, key: DemonAltarKey): number {
  const power = powerOf(p, key);
  const altar = p.demonAltars?.[key];
  if (!power || !altar || altar.rewards.length < 2) return 0;
  return Math.max(0, power.rounds.filter((r) => r <= round).length - altar.used);
}

// The next round the altar earns an activation, or null.
export function nextAltarRound(round: number, p: Player, key: DemonAltarKey): number | null {
  return powerOf(p, key)?.rounds.find((r) => r > round) ?? null;
}

// Why this player can't activate the altar now, discarding reward `discard` (its index), or null.
export function activateBlock(state: GameState, p: Player, key: DemonAltarKey, discard: number): string | null {
  const altar = p.demonAltars?.[key];
  if (!powerOf(p, key) || !altar) return "You don't have that altar";
  if (altar.rewards.length < 2) return 'The altar is empty';
  if (!altarCharges(state.round, p, key)) return 'No activation left';
  if (!Number.isInteger(discard) || discard < 0 || discard >= altar.rewards.length) return 'Pick a reward to discard';
  return null;
}

// Discards reward `discard`, then pays one of the rest at random; both leave the altar.
export function activateAltar(state: GameState, p: Player, key: DemonAltarKey, discard: number): string | null {
  const block = activateBlock(state, p, key, discard);
  if (block) return block;
  const altar = p.demonAltars![key]!;
  const [dropped] = altar.rewards.splice(discard, 1);
  const [won] = altar.rewards.splice(nextInt(state, altar.rewards.length), 1);
  altar.used++;
  const text = ALTAR_REWARD_BY_ID[won].give(state, p);
  altar.last = { discarded: dropped, won, text };
  return null;
}
