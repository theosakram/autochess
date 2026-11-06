// 0.075 -> "7.5%", 0.2 -> "20%"
export const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;

// A counting trait's milestone reward in words; `unit` names its reward unit.
export function rewardText(r: import('./types').StackReward, unit: string): string {
  if ('star' in r) return `${unit} ${'★'.repeat(r.star)}`;
  if ('gold' in r) return `+${r.gold} gold`;
  if ('equipment' in r) return r.equipment === 1 ? 'a random equipment' : `${r.equipment} random equipment`;
  return r.orbs === 1 ? 'a Magic Orb' : `${r.orbs} Magic Orbs`;
}
