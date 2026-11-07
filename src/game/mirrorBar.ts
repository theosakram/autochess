import { powersOf } from './commanders';
import type { Player } from './types';

// Amon's Mirror Bar (see commanders/amon.ts) and his card's gold, both fed by heroes reaching 2 stars.

// Hands over the starting Mirror Device the first time the power works for the player (Amon picked, or his
// card on another commander). Run on every sync.
export function syncMirrorBar(p: Player): void {
  const power = powersOf(p).mirrorBar;
  if (!power || p.mirrorBar) return;
  p.mirrorBar = { steps: 0, made: 0 };
  p.mirrors = (p.mirrors ?? 0) + power.start;
}

// A hero just reached 2 stars: a step on the bar (a full bar makes a Mirror Device and pays gold, until
// it has made its max), and the card's gold.
export function onTwoStar(p: Player): void {
  const pw = powersOf(p);
  const bar = pw.mirrorBar && p.mirrorBar;
  if (bar && bar.made < pw.mirrorBar!.max) {
    bar.steps++;
    if (bar.steps >= pw.mirrorBar!.steps) {
      bar.steps = 0;
      bar.made++;
      p.mirrors = (p.mirrors ?? 0) + 1;
      p.gold += pw.mirrorBar!.gold;
    }
  }
  const sg = pw.starGold;
  if (sg) {
    const paid = p.starGold ?? 0;
    const gold = Math.min(sg.gold, sg.max - paid);
    if (gold > 0) {
      p.starGold = paid + gold;
      p.gold += gold;
    }
  }
}
