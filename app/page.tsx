'use client';
import { useSyncExternalStore } from 'react';
import SoloGame from '@/components/game/solo';
import { Account, MyTables } from '@/components/online/account';
import { SharedTable } from '@/components/online/table';
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
  const match = /^\/table\/([A-Za-z0-9_-]{32})$/.exec(path);
  if (match) return <SharedTable invite={match[1]} />;
  return <SoloGame />;
}
