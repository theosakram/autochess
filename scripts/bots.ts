// Bot strength harness: `bun run bots`. Plays whole 8-player games between bot levels and reports each
// level's average place (1 = won). GAMES=500 for more precision; MIX=easy:4,normal:4 picks the seats.
import { createGame, isGameOver, resolveCombat, startRound } from '../src/game/game';
import type { BotLevel } from '../src/game/types';

const GAMES = Number(process.env.GAMES ?? 100);
const MIX = (process.env.MIX ?? 'easy:4,normal:4').split(',').flatMap((part) => {
  const [level, n] = part.split(':');
  return Array.from({ length: Number(n) }, () => level as BotLevel);
});

const stats: Record<string, { seats: number; place: number; wins: number; top4: number; level: number }> = {};
let rounds = 0;
const started = Date.now();
for (let g = 0; g < GAMES; g++) {
  // Seats rotate so no level always sits in the same place in the pairing order.
  const seats = MIX.map((_, i) => MIX[(i + g) % MIX.length]);
  const st = createGame(1000 + g, seats.map((botLevel, i) => ({ id: `b${i}`, name: `${botLevel} ${i}`, isBot: true, botLevel })));
  while (!isGameOver(st) && st.round < 60) {
    resolveCombat(st);
    if (!isGameOver(st)) startRound(st);
  }
  rounds += st.round;
  for (const p of st.players) {
    const s = (stats[p.botLevel ?? 'easy'] ??= { seats: 0, place: 0, wins: 0, top4: 0, level: 0 });
    const place = p.place ?? 1;
    s.seats++;
    s.place += place;
    s.wins += place === 1 ? 1 : 0;
    s.top4 += place <= 4 ? 1 : 0;
    s.level += p.level;
  }
}
console.log(`${GAMES} games, ${(rounds / GAMES).toFixed(1)} rounds avg, ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.table(
  Object.fromEntries(
    Object.entries(stats).map(([level, s]) => [
      level,
      {
        'avg place': +(s.place / s.seats).toFixed(2),
        'win %': +((100 * s.wins) / s.seats).toFixed(1), // per seat: 12.5% is par in an 8-player game
        'top 4 %': +((100 * s.top4) / s.seats).toFixed(1),
        'final level': +(s.level / s.seats).toFixed(1),
      },
    ]),
  ),
);
