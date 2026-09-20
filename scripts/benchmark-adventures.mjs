import { standaloneGames, botMove } from '../lib/games/standalone/registry.ts';
for (const id of ['orin', 'vela', 'miro'])
  for (const n of standaloneGames[id].seatChoices) {
    let wins = 0,
      blue = 0,
      stalls = 0,
      rounds = 0;
    for (let s = 0; s < 250; s++) {
      const e = standaloneGames[id];
      let g = e.create(n, Math.imul(s + 1, 2654435761) >>> 0, 'hard');
      for (let i = 0; i < 1000 && !g.over; i++) {
        const seat = e.actingSeats(g)[0],
          m = botMove(g, seat);
        if (!m) break;
        g = e.play(g, m, seat);
      }
      if (!g.over) stalls++;
      else {
        const o = e.outcome(g);
        if (
          (id === 'orin' && o.winners.length) ||
          (id === 'miro' && o.winners.length > 1)
        )
          wins++;
        if (id === 'vela' && o.winners.includes(0)) blue++;
      }
      rounds += g.round;
    }
    console.log(id, n, { wins, blue, stalls, rounds: rounds / 250 });
  }
