'use client';
import { useEffect, useRef, useState } from 'react';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { ArrowLeft, Bot, Crown, House, UserCog, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { requiresHumanPlayers } from '@/lib/games/player-policy';
import type { Member, Table, TableCommand } from '@/lib/online/types';
import './game-menu.css';
import './table-manager.css';

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

/** The back control the Table button stands in for, in every game. */
const BACK = '.game-navigation-back, .table-back, .arena-back';

/** Puts the trigger in the back control's slot, centred on its height, and
 *  hides that control while the admin is at the table: for the admin the top
 *  left holds only the Table button, and Leave moves into its panel. */
function usePlacement(
  trigger: React.RefObject<HTMLElement | null>,
  admin: boolean,
) {
  useEffect(() => {
    if (!admin) return;
    const root = document.documentElement;
    root.dataset.tableAdmin = '';
    return () => {
      delete root.dataset.tableAdmin;
    };
  }, [admin]);
  useEffect(() => {
    const node = trigger.current;
    if (!node) return;
    function position() {
      if (!node) return;
      const back = Array.from(document.querySelectorAll<HTMLElement>(BACK))
        .find((el) => el.getClientRects().length)
        ?.getBoundingClientRect();
      if (!back) {
        node.style.removeProperty('--table-manager-top');
        node.style.removeProperty('--table-manager-left');
        return;
      }
      node.style.setProperty(
        '--table-manager-top',
        `${back.top + (back.height - node.offsetHeight) / 2}px`,
      );
      node.style.setProperty('--table-manager-left', `${back.left}px`);
    }
    position();
    const observer = new ResizeObserver(position);
    for (const el of document.querySelectorAll(BACK)) observer.observe(el);
    window.addEventListener('resize', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
    };
  });
}

/**
 * The table admin's controls during a game, the same in every game: a Table
 * button at the top left, in place of the back control, and a panel that
 * drops down from it along the left side, tinted like the game's menu. Only
 * the admin sees it. Players first, each with what the admin can do for
 * them, then leaving (the hidden back control's own action), returning to
 * the lobby and closing the table; the last two ask once, inside the panel,
 * because they end the game for everyone.
 */
export function TableManager({
  table,
  connected,
  disabled = false,
  theme,
  dispatch,
  error,
}: {
  table: Table;
  connected: boolean;
  disabled?: boolean;
  /** The game's menu theme, so the panel matches its Menu. */
  theme?: string;
  dispatch: (action: TableCommand) => unknown;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'lobby' | 'close' | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  usePlacement(trigger, !!table.isHost);
  if (!table.isHost) return null;
  const playing = table.status === 'playing';
  // A game in progress, here or in the room the table moved on to (Folio, Lucky).
  const live = playing || !!table.handoff;
  const bots = !requiresHumanPlayers(table.gameId);
  function toggle(next: boolean) {
    setOpen(next);
    if (!next) {
      setConfirm(null);
      setPicked(null);
    }
  }
  /** Leaves the way the game's own back control does (its leave dialog included). */
  function leave() {
    toggle(false);
    document.querySelector<HTMLElement>(BACK)?.click();
  }
  function run(action: TableCommand) {
    toggle(false);
    void dispatch(action);
  }
  /** What the admin can do for another player. */
  function actions(m: Member) {
    if (m.bot || m.owner) return [];
    return [
      {
        key: 'owner',
        icon: Crown,
        label: 'Make admin',
        action: { type: 'owner', memberId: m.id } as const,
      },
      ...(playing && bots && !m.connected && m.seat !== null && !!table.game
        ? [
            {
              key: 'replace',
              icon: Bot,
              label: 'Bot takes the seat',
              action: { type: 'replace', memberId: m.id } as const,
            },
          ]
        : []),
    ];
  }
  return (
    <Popover open={open} onOpenChange={toggle} modal>
      <PopoverTrigger
        ref={trigger}
        className="table-manager-trigger"
        data-menu-theme={theme}
        aria-label={`Manage the table${connected ? '' : ', reconnecting'}`}
      >
        <UserCog aria-hidden="true" />
        <span>Table</span>
        <i
          className="table-manager-dot"
          data-connected={connected || undefined}
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent
        className="game-menu table-manager"
        data-menu-theme={theme}
        side="bottom"
        align="start"
        sideOffset={8}
      >
        <PopoverTitle className="sr-only">Manage the table</PopoverTitle>
        <PopoverPrimitive.Close className="sr-only">
          Close table panel
        </PopoverPrimitive.Close>
        {confirm ? (
          <div className="table-manager-confirm">
            <strong>
              {confirm === 'lobby'
                ? 'End this game for everyone?'
                : 'Close the table for everyone?'}
            </strong>
            <button
              type="button"
              className="table-manager-primary"
              disabled={disabled}
              onClick={() =>
                run({ type: confirm === 'lobby' ? 'abandon' : 'close' })
              }
            >
              {confirm === 'lobby' ? 'End game' : 'Close table'}
            </button>
            <button type="button" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <ul className="table-manager-people" aria-label="Players">
              {table.members.map((m) => {
                const options = actions(m);
                const shown = picked === m.id && options.length > 0;
                const face = (
                  <>
                    <span
                      className="table-manager-avatar"
                      data-away={(!m.bot && !m.connected) || undefined}
                    >
                      {m.bot ? <Bot aria-hidden="true" /> : initial(m.name)}
                    </span>
                    <span className="table-manager-name">
                      {m.name}
                      {m.id === table.viewerId && <small> · you</small>}
                    </span>
                    {m.owner && (
                      <Crown
                        className="table-manager-crown"
                        aria-label="Admin"
                      />
                    )}
                  </>
                );
                return (
                  <li key={`${m.id}-${m.bot}`} data-open={shown || undefined}>
                    {options.length ? (
                      <button
                        type="button"
                        className="table-manager-person"
                        aria-expanded={shown}
                        disabled={disabled}
                        onClick={() => setPicked(shown ? null : m.id)}
                        aria-label={`${m.name}${m.connected ? '' : ', away'}`}
                      >
                        {face}
                      </button>
                    ) : (
                      <div className="table-manager-person">{face}</div>
                    )}
                    {shown && (
                      <div className="table-manager-person-actions">
                        {options.map(({ key, icon: Icon, label, action }) => (
                          <button
                            key={key}
                            type="button"
                            disabled={disabled}
                            onClick={() => run(action)}
                          >
                            <Icon aria-hidden="true" />
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="game-menu-group">
              <button type="button" onClick={leave}>
                <ArrowLeft aria-hidden="true" />
                Leave
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  live ? setConfirm('lobby') : run({ type: 'abandon' })
                }
              >
                <House aria-hidden="true" />
                Back to lobby
              </button>
              <button
                type="button"
                className="table-manager-danger"
                disabled={disabled}
                onClick={() => setConfirm('close')}
              >
                <X aria-hidden="true" />
                Close table
              </button>
            </div>
          </>
        )}
        {error && (
          <p className="game-menu-message" role="alert">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
