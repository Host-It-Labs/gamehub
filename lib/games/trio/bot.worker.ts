import { chooseMove } from './bot';
import type { Observation } from './engine';
self.onmessage = (event: MessageEvent<Observation>) => {
  try {
    self.postMessage({ move: chooseMove(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Bot calculation failed',
    });
  }
};
