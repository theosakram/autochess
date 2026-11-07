import '../src/game/testUnits';
import { simulateCombat } from '../src/game/combat';
import { makePlayer } from './balance';
const RUNS = 20;
const SIX: Record<string, string[]> = {
  dragonaltar: ['siyunyin', 'luoyi', 'wan', 'suyu', 'yang', 'balia'],
  skybringer: ['eudora', 'balman', 'clint', 'gufron', 'zhizong', 'balang'],
  gustiwana: ['dyroth', 'angela', 'frank', 'kari', 'lunox', 'lance'],
  cultoffire: ['cici', 'zhuxin', 'mia', 'edith', 'lola', 'fanny'],
  astral: ['minos', 'martin', 'katarina', 'hilman', 'irina', 'odette'],
  necromancer: ['val', 'natalie', 'harley', 'tig', 'sora', 'thamar'],
  spectre: ['phove', 'ginger', 'saber', 'pacquiao', 'gourd', 'alice'],
};
const FOUR: Record<string, string[]> = {
  dragonaltar: ['siyunyin', 'luoyi', 'wan', 'yang'],
  skybringer: ['eudora', 'balman', 'clint', 'gufron'],
  gustiwana: ['dyroth', 'angela', 'frank', 'kari'],
  cultoffire: ['cici', 'zhuxin', 'edith', 'lola'],
  astral: ['minos', 'martin', 'katarina', 'irina'],
  necromancer: ['val', 'natalie', 'tig', 'sora'],
  spectre: ['phove', 'ginger', 'saber', 'gourd'],
};
function rate(x: string[], y: string[], mult: number, myTraits = true): number {
  const a = makePlayer('a', x), b = makePlayer('b', y);
  let s = 0;
  for (let i = 0; i < RUNS; i++) {
    const side = i % 2;
    const r = simulateCombat({ rng: (i + 1) * 2654435761 }, side ? b : a, side ? a : b, { chosen: { storyweaver: 'altus' }, statMult: side ? [mult, 1] : [1, mult], traits: side ? [true, myTraits] : [myTraits, true] });
    s += r.winner === side ? 1 : r.winner === null ? 0.5 : 0;
  }
  return s / RUNS;
}
function edge(x: string[], y: string[], myTraits = true): string {
  let lo = 0.3, hi = 4;
  for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; if (rate(x, y, m, myTraits) > 0.5) lo = m; else hi = m; }
  const m = (lo + hi) / 2;
  return `${m >= 1 ? '+' : ''}${Math.round((m - 1) * 100)}%`;
}
const me = process.env.FAC!;
const rows: [string, string[], Record<string, string[]>, boolean?][] = JSON.parse(process.env.ROWS!);
console.log(`STAR=${process.env.STAR ?? 1}`);
for (const [label, team, pool, traits] of rows.map(([l, t, p, tr]) => [l, t, (p as any) === 'six' ? SIX : FOUR, tr] as const)) {
  console.log(`${label.padEnd(26)} ` + Object.entries(pool).filter(([n]) => n !== me).map(([n, t]) => `${n.slice(0, 6)} ${edge(team, t, traits !== false)}`).join(', '));
}
