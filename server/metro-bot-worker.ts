import { parentPort, workerData } from 'node:worker_threads';
import { botTurn } from '../lib/games/metro/bot.ts';
parentPort!.postMessage(botTurn(workerData.game, workerData.seat));
