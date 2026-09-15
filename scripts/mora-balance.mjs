import { createGame, play, observe, zoneScore, scores } from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';

// Fixed seeds and equal seat counts make before/after tuning reproducible.
const gamesPerSize = Number(process.argv[2] ?? 40);
const totals = Array.from({ length: 7 }, () => ({ creatures: 0, points: 0, occupied: 0, full: 0 }));
let boards = 0;
let total = 0;
let releases = 0;
for (let seats = 2; seats <= 6; seats++) {
  for (let seed = 1; seed <= gamesPerSize; seed++) {
    let g = createGame('wildgrove', 'medium', seed, false, seats);
    while (g.phase !== 'over') {
      const move = chooseMove(observe(g), 'medium');
      if (move.type === 'play' && move.zone === 5) releases++;
      g = play(g, move);
    }
    total += scores(g).reduce((a, b) => a + b, 0);
    for (const p of g.players) {
      boards++;
      for (let z = 0; z < 7; z++) {
        const n = p.zones[z].length;
        totals[z].creatures += n;
        totals[z].points += zoneScore(p.zones, z);
        totals[z].occupied += Number(n > 0);
        totals[z].full += Number(n === (z === 3 || z === 6 ? 3 : 4));
      }
    }
  }
}
console.log(JSON.stringify({
  games: gamesPerSize * 5,
  boards,
  averageScore: +(total / boards).toFixed(2),
  releasesPerBoard: +(releases / boards).toFixed(2),
  zones: totals.map((t, zone) => ({
    zone,
    creaturesPerBoard: +(t.creatures / boards).toFixed(2),
    pointsPerBoard: +(t.points / boards).toFixed(2),
    pointsPerCreature: +(t.points / (t.creatures || 1)).toFixed(2),
    occupiedPercent: +(100 * t.occupied / boards).toFixed(1),
    fullPercent: +(100 * t.full / boards).toFixed(1),
  })),
}, null, 2));
