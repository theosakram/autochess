// mulberry32. State lives in GameState.rng so games replay exactly from a seed.
export function nextFloat(s: { rng: number }): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(s: { rng: number }, n: number): number {
  return Math.floor(nextFloat(s) * n);
}

export function shuffle<T>(s: { rng: number }, items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = nextInt(s, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
