'use client';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import SoloGame from '@/components/game/solo';
import { Account, MyTables } from '@/components/online/account';
import { SharedTable } from '@/components/online/table';
import Relic from '@/components/game/relic';
import Folio from '@/components/game/folio';
// Dev-only bench; the import is dead code in production so no chunk ships.
const FolioLab =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('@/components/game/folio-lab'))
    : null;
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
  const folio = /^\/folio\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (folio) return <Folio invite={folio[1]} />;
  const expedition = /^\/expedition\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (expedition) return <Relic invite={expedition[1]} />;
  const match = /^\/table\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (match) return <SharedTable invite={match[1]} />;
  return <SoloGame />;
}
