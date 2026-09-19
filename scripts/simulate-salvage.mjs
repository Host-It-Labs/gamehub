import {
  createGame,
  play,
  observe,
  validMove,
  isSavedGame,
} from '../lib/games/trio/engine.ts';
import { chooseMove } from '../lib/games/trio/bot.ts';
const seedCount = Number(process.argv[2] ?? 25);
const results = [];
for (const players of [2, 3, 6])
  for (const fastMode of [false, true])
    for (const turningTide of [false, true]) {
      const stats = Object.fromEntries(
        ['strategic', 'always', 'never'].map((policy) => [
          policy,
          { score: 0, claims: 0, wins: 0, games: 0 },
        ]),
      );
      for (let seed = 1; seed <= seedCount; seed++)
        for (const policy of Object.keys(stats)) {
          const focal = seed % players;
          let g = createGame(
            'undertow',
            'medium',
            seed,
            false,
            players,
            true,
            fastMode,
            false,
            false,
            { salvage: true, turningTide },
          );
          let steps = 0;
          while (g.phase !== 'over') {
            const actor = g.active;
            const move =
              g.phase === 'salvage' && actor === focal && policy !== 'strategic'
                ? { type: 'salvage', claim: policy === 'always' }
                : chooseMove(observe(g), 'medium');
            if (!validMove(g, move)) throw new Error('Invalid simulated move');
            if (actor === focal && move.type === 'salvage' && move.claim)
              stats[policy].claims++;
            g = play(g, move);
            if (++steps > 2000) throw new Error('Simulation did not terminate');
          }
          if (!isSavedGame(g)) throw new Error('Invalid simulation result');
          const focalScore = g.players[focal].score;
          stats[policy].score += focalScore;
          stats[policy].wins += Number(
            focalScore === Math.min(...g.players.map((p) => p.score)),
          );
          stats[policy].games++;
        }
      results.push({
        players,
        fastMode,
        turningTide,
        policies: Object.fromEntries(
          Object.entries(stats).map(([policy, s]) => [
            policy,
            {
              games: s.games,
              meanPenalty: +(s.score / s.games).toFixed(2),
              meanClaims: +(s.claims / s.games).toFixed(2),
              winsIncludingTies: s.wins,
            },
          ]),
        ),
      });
    }
process.stdout.write(
  JSON.stringify(
    {
      seedCount,
      note: 'Paired seeds, focal seat rotates; other seats use medium public-information bots. Lower score is better. This is an automated policy comparison, not human balance acceptance.',
      results,
    },
    null,
    2,
  ) + '\n',
);
