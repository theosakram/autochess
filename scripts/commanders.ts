// Commander balance harness: `bun run commanders`. Plays whole 8-player games of normal bots, every seat on
// a commander dealt in rotation (so each plays about as often, from every seat), and reports each one's
// average place. Bots take their own commander's card, so this is commander + own card.
// GAMES=300 for more precision; LEVEL=easy for easy bots; ONLY=kaela,freya to deal just those (others fill).
import { COMMANDERS } from '../src/game/commanders';
import { createGame, isGameOver, resolveCombat, startRound } from '../src/game/game';
import type { BotLevel } from '../src/game/types';

const GAMES = Number(process.env.GAMES ?? 120);
const LEVEL = (process.env.LEVEL ?? 'normal') as BotLevel;
const IDS = Object.keys(COMMANDERS);

const stats: Record<string, { seats: number; place: number; wins: number; top4: number; ms: number }> = {};
const started = Date.now();
for (let g = 0; g < GAMES; g++) {
  const t0 = Date.now();
  // Deal 8 commanders in rotation, offset each game.
  const picks = Array.from({ length: 8 }, (_, i) => IDS[(g * 8 + i) % IDS.length]);
  const st = createGame(5000 + g, picks.map((commander, i) => ({ id: `b${i}`, name: `${commander} ${i}`, isBot: true, botLevel: LEVEL, commander })));
  while (!isGameOver(st) && st.round < 60) {
    resolveCombat(st);
    if (!isGameOver(st)) startRound(st);
  }
  const ms = Date.now() - t0;
  for (const p of st.players) {
    const s = (stats[p.commander!] ??= { seats: 0, place: 0, wins: 0, top4: 0, ms: 0 });
    const place = p.place ?? 1;
    s.seats++;
    s.place += place;
    s.wins += place === 1 ? 1 : 0;
    s.top4 += place <= 4 ? 1 : 0;
    s.ms += ms / 8;
  }
}
console.log(`${GAMES} games of ${LEVEL} bots, ${((Date.now() - started) / 1000).toFixed(1)}s. Par: place 4.5, win 12.5%, top 4 50%.`);
const rows = Object.entries(stats)
  .map(([id, s]) => ({ id, place: s.place / s.seats, s }))
  .sort((a, b) => a.place - b.place);
console.table(
  Object.fromEntries(
    rows.map(({ id, place, s }) => [
      COMMANDERS[id].name,
      {
        seats: s.seats,
        'avg place': +place.toFixed(2),
        'win %': +((100 * s.wins) / s.seats).toFixed(1),
        'top 4 %': +((100 * s.top4) / s.seats).toFixed(1),
      },
    ]),
  ),
);
