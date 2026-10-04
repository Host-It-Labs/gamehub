import { parentPort, workerData } from 'node:worker_threads';
import { botRound } from '../lib/games/rota/bot.ts';
parentPort!.postMessage(botRound(workerData.game, workerData.seat));
