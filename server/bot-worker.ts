import { parentPort, workerData } from 'node:worker_threads';
import { chooseMove } from '../lib/games/trio/bot.ts';
parentPort!.postMessage(chooseMove(workerData));
