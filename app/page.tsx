'use client';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import SoloGame from '@/components/game/solo';
import { Account, MyTables } from '@/components/online/account';
import { SharedTable } from '@/components/online/table';
import Relic from '@/components/game/relic';
import Folio from '@/components/game/folio';
import { GameStartup } from '@/components/game/game-curtain';
// Dev-only bench; the import is dead code in production so no chunk ships.
const FolioLab =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('@/components/game/folio-lab'))
    : null;
const ArenaLab =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('@/components/game/arena/arena-lab'))
    : null;
const AltoLab =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('@/components/game/alto/alto-lab'))
    : null;
const SoundLab = lazy(() => import('@/components/game/sound-lab'));
// An online battle loads three.js with the rest of Arena, only when opened.
const ArenaRoom = lazy(() => import('@/components/game/arena/arena-room'));
const RotaRoom = lazy(() => import('@/components/game/rota/rota-room'));
// An online Alto match loads its table only when opened.
const AltoRoom = lazy(() => import('@/components/game/alto/alto-room'));
// An online Diner shift loads three.js with the diner only when opened.
const DinerRoom = lazy(() => import('@/components/game/diner/diner-room'));
const subscribe = () => () => {};
export default function Gamehub() {
  const path = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => null,
  );
  if (path === null)
    return (
      <main className="startup-loading" aria-busy="true">
        <output className="startup-loading-content">
          <span className="startup-tiles" aria-hidden="true">
            <i>✦</i>
            <i>✿</i>
            <i>☾</i>
          </span>
          <strong>Gamehub</strong>
          <span>A little moment before we play</span>
        </output>
      </main>
    );
  if (path === '/sound-lab') return <Suspense fallback={<main className="startup-loading" aria-busy="true">Sound Lab</main>}><SoundLab /></Suspense>;
  if (path === '/auth') return <Account />;
  if (path === '/tables') return <MyTables />;
  if (path === '/relic') return <Relic />;
  if (path === '/folio') return <Folio />;
  if (path === '/folio/lab' && FolioLab)
    return (
      <Suspense fallback={null}>
        <FolioLab />
      </Suspense>
    );
  if (path === '/arena/lab' && ArenaLab)
    return (
      <Suspense fallback={null}>
        <ArenaLab />
      </Suspense>
    );
  if (path === '/alto/lab' && AltoLab)
    return (
      <Suspense fallback={null}>
        <AltoLab />
      </Suspense>
    );
  const folio = /^\/folio\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (folio) return <Folio invite={folio[1]} />;
  const expedition = /^\/expedition\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (expedition) return <Relic invite={expedition[1]} />;
  const shift = /^\/diner\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (shift)
    return (
      <Suspense fallback={<GameStartup game="diner" name="Diner" />}>
        <DinerRoom token={shift[1]} />
      </Suspense>
    );
  const voyage = /^\/alto\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (voyage)
    return (
      <Suspense fallback={<GameStartup game="alto" name="Alto" />}>
        <AltoRoom token={voyage[1]} />
      </Suspense>
    );
  const survey = /^\/rota\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (survey)
    return (
      <Suspense fallback={<GameStartup game="rota" name="Rota" />}>
        <RotaRoom token={survey[1]} />
      </Suspense>
    );
  const battle = /^\/arena\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (battle)
    return (
      <Suspense fallback={<GameStartup game="arena" name="Arena" />}>
        <ArenaRoom token={battle[1]} />
      </Suspense>
    );
  const match = /^\/table\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (match) return <SharedTable invite={match[1]} />;
  return <SoloGame />;
}
