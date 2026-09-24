import { boxCover } from '../games/box-covers.ts';
import { catalog } from '../games/trio/engine';
import { publicStandaloneIds, standaloneGames } from '../games/standalone/registry';
export const onlineCatalog = [
  ...catalog,
  ...publicStandaloneIds.map((id) => ({
    id,
    name: standaloneGames[id].name,
    cover: boxCover(id)!,
    genre:
      id === 'orin' ? 'Knowing each other' : 'Trivia',
  })),
];
