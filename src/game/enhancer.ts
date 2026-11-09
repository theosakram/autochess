import { canEnhance, enhanceItem, ITEMS } from './items';
import { addXp } from './player';
import type { Player } from './types';

// Minos's Enhancement charges (Player.enhancers counts them): each one enhances an owned item of the player's
// choice, and pays gold and XP. Tune with `bun run commanders`.
export const ENHANCER = {
  name: 'Enhancement Charge',
  icon: '⚒️',
  gold: 3,
  xp: 3,
  desc: 'Use it on one of your items to turn it into its enhanced version. Each use also gives 3 gold and 3 XP.',
};

// Items a charge can go on: owned (not lent), with an enhanced version, not enhanced yet.
export const canUseEnhancer = (p: Player, uid: number): boolean => {
  const it = p.items.find((i) => i.uid === uid);
  return !!it && !it.loan && canEnhance(it.id);
};

// Why item `uid` can't take a charge, or null.
export function enhancerBlock(p: Player, uid: number): string | null {
  if (!p.enhancers) return 'You have no Enhancement Charge';
  const it = p.items.find((i) => i.uid === uid && !i.loan);
  if (!it) return 'Pick one of your items to enhance';
  if (!canEnhance(it.id)) return `The ${ITEMS[it.id].name} can't be enhanced`;
  return null;
}

// Spends one charge on item `uid`: enhanced, plus the gold and XP. Returns an error, or null.
export function useEnhancer(p: Player, uid: number): string | null {
  const err = enhancerBlock(p, uid);
  if (err) return err;
  enhanceItem(p.items.find((i) => i.uid === uid)!);
  p.enhancers = p.enhancers! - 1 || undefined;
  p.gold += ENHANCER.gold;
  addXp(p, ENHANCER.xp);
  return null;
}
