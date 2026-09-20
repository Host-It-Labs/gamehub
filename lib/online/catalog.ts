import { catalog } from '../games/trio/engine';
import { standaloneIds, standaloneGames } from '../games/standalone/registry';
export const onlineCatalog = [
  ...catalog,
  ...standaloneIds.map((id) => ({
    id,
    name: standaloneGames[id].name,
    cover: id === 'miro' ? '/art/atlas-cover.svg' : `/art/party-${id === 'orin' ? 'top-tier' : 'outfox'}-cover-v1.webp`,
    genre:
      id === 'orin'
        ? 'Personal rankings'
        : id === 'vela'
          ? 'Ranking & bluffing'
          : 'Geography & shared challenges',
  })),
];
