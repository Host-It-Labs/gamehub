'use client';
import {
  Check,
  ClipboardPaste,
  Coins,
  Copy,
  Lock,
  RotateCw,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { formatNumber } from '@/lib/games/relic/engine';
import {
  BLUEPRINTS,
  MACHINES,
  boost,
  type Machine,
  type MachineKind,
} from '@/lib/games/relic/factory';
import {
  PACKS,
  bookLevel,
  printLevel,
  packOpen,
  type PackId,
  type ScratchState,
} from '@/lib/games/relic/scratch';
import { TICKET_ART } from '../relic-scratch-art';
import { STATUS_WORD, statusOf } from './status';
import { MachineIcon } from './machine-icon';
import { MACHINE_COLOUR } from './palette';

const LEVEL_NAMES = ['I', 'II', 'III'];

/** What the bar under the floor is about. */
export type BarView =
  | { kind: 'locked'; machine: MachineKind }
  | { kind: 'build'; machine: MachineKind; count: number; cost: number }
  | {
      kind: 'paste';
      kinds: MachineKind[];
      cost: number;
      ok: boolean;
      confirm: boolean;
    }
  | { kind: 'erase'; count: number; refund: number }
  | { kind: 'one'; m: Machine; refund: number }
  /** The machine under the mouse while nothing is selected: named, no actions. */
  | { kind: 'peek'; m: Machine }
  | { kind: 'many'; machines: Machine[]; refund: number }
  | { kind: 'idle'; canPaste: boolean };

export type BarActions = {
  onUnlock: (kind: MachineKind) => void;
  onRotate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onBook: (book: PackId) => void;
  onPlace: () => void;
  onCancel: () => void;
  onPaste: () => void;
};

function Art({ kind, locked }: { kind: MachineKind; locked?: boolean }) {
  return (
    <span
      className="rf-bar-art"
      style={{ '--machine': MACHINE_COLOUR[kind] } as React.CSSProperties}
    >
      <MachineIcon kind={kind} />
      {locked && <Lock size={14} className="rf-part-lock" />}
    </span>
  );
}
function Price({
  amount,
  coins,
  sign = '',
}: {
  amount: number;
  coins?: number;
  sign?: string;
}) {
  return (
    <span
      className={`rf-bar-price ${coins !== undefined && coins < amount ? 'is-short' : ''}`}
    >
      <Coins size={14} />
      {sign}
      {formatNumber(amount)}
    </span>
  );
}
function Action({
  icon,
  label,
  onClick,
  disabled,
  tone,
  keys,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger' | 'primary';
  keys?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rf-action ${tone ? `is-${tone}` : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={keys ? `${label} (${keys})` : label}
    >
      {icon}
      <span>{label}</span>
      {children}
    </button>
  );
}

/** The bar under the floor: what is selected or held, and what to do with it. */
export function FactoryBar({
  view,
  state,
  coins,
  busy,
  actions: a,
}: {
  view: BarView;
  state: ScratchState;
  coins: number;
  busy: boolean;
  actions: BarActions;
}) {
  const f = state.factory;
  if (view.kind === 'locked') {
    const blueprint = BLUEPRINTS.find((b) => b.kinds.includes(view.machine))!;
    return (
      <div className="rf-bar is-locked" aria-live="polite">
        <Art kind={view.machine} locked />
        <Text
          name={MACHINES[view.machine].name}
          does={MACHINES[view.machine].does}
        />
        <div className="rf-bar-actions">
          <button
            type="button"
            className="rs-primary rf-unlock"
            disabled={busy || coins < blueprint.price}
            onClick={() => a.onUnlock(view.machine)}
          >
            <Unlock size={16} />
            Unlock
            <span className="rs-again-price">
              <Coins size={13} />
              {formatNumber(blueprint.price)}
            </span>
          </button>
        </div>
      </div>
    );
  }
  if (view.kind === 'build')
    return (
      <div className="rf-bar" aria-live="polite">
        <Art kind={view.machine} />
        <Text
          name={MACHINES[view.machine].name}
          does={MACHINES[view.machine].does}
        />
        <div className="rf-bar-actions">
          <span className="rf-bar-count">
            {view.count > 1 && <b>{view.count} ×</b>}
            <Price amount={view.cost} coins={coins} />
          </span>
          {MACHINES[view.machine].turns && (
            <Action
              icon={<RotateCw size={16} />}
              label="Rotate"
              keys="R"
              onClick={a.onRotate}
            />
          )}
          <Action
            icon={<X size={16} />}
            label="Done"
            keys="Esc"
            onClick={a.onCancel}
          />
        </div>
      </div>
    );
  if (view.kind === 'paste')
    return (
      <div className="rf-bar" aria-live="polite">
        <Group count={view.kinds.length} kinds={view.kinds} />
        <div className="rf-bar-actions">
          <Price amount={view.cost} coins={coins} />
          <Action
            icon={<RotateCw size={16} />}
            label="Rotate"
            keys="R"
            onClick={a.onRotate}
          />
          {view.confirm && (
            <Action
              icon={<Check size={16} />}
              label="Place"
              tone="primary"
              disabled={!view.ok}
              onClick={a.onPlace}
            />
          )}
          <Action
            icon={<X size={16} />}
            label="Cancel"
            keys="Esc"
            onClick={a.onCancel}
          />
        </div>
      </div>
    );
  if (view.kind === 'erase')
    return (
      <div className="rf-bar" aria-live="polite">
        <span className="rf-bar-glyph is-danger" aria-hidden="true">
          <Trash2 size={20} />
        </span>
        <Text name={view.count ? `${view.count}` : 'Erase'} />
        <div className="rf-bar-actions">
          {view.refund > 0 && <Price amount={view.refund} sign="+" />}
          <Action
            icon={<X size={16} />}
            label="Done"
            keys="Esc"
            onClick={a.onCancel}
          />
        </div>
      </div>
    );
  if (view.kind === 'peek') {
    const m = view.m,
      status = m.kind === 'belt' ? null : statusOf(f, m);
    return (
      <div className="rf-bar is-peek" aria-live="polite">
        <Art kind={m.kind} />
        <Text
          name={MACHINES[m.kind].name}
          status={
            status && m.kind !== 'splitter' && m.kind !== 'cashier'
              ? status
              : null
          }
          does={MACHINES[m.kind].does}
        />
      </div>
    );
  }
  if (view.kind === 'one') {
    const m = view.m,
      b = boost(f, m),
      status = m.kind === 'belt' ? null : statusOf(f, m);
    const extra = [
      b.speed > 1 && `+${Math.round((b.speed - 1) * 100)}% speed`,
      b.stars > 0 && `+${Math.round(b.stars * 100)}% stars`,
    ].filter(Boolean);
    return (
      <div className="rf-bar" aria-live="polite">
        <Art kind={m.kind} />
        <Text
          name={MACHINES[m.kind].name}
          status={
            status && m.kind !== 'splitter' && m.kind !== 'cashier'
              ? status
              : null
          }
          does={`${MACHINES[m.kind].does}${extra.length ? ` Now ${extra.join(', ')}.` : ''}`}
        />
        {m.kind === 'printer' && (
          <Books
            state={state}
            chosen={[m.book]}
            busy={busy}
            onBook={a.onBook}
          />
        )}
        <div className="rf-bar-actions">
          {MACHINES[m.kind].turns && (
            <Action
              icon={<RotateCw size={16} />}
              label="Rotate"
              keys="R"
              onClick={a.onRotate}
            />
          )}
          <Action
            icon={<Copy size={16} />}
            label="Copy"
            keys="⌘C"
            onClick={a.onCopy}
          />
          <Action
            icon={<Trash2 size={16} />}
            label="Delete"
            keys="Del"
            tone="danger"
            onClick={a.onDelete}
          >
            <Price amount={view.refund} sign="+" />
          </Action>
        </div>
      </div>
    );
  }
  if (view.kind === 'many') {
    const printers = view.machines.filter((m) => m.kind === 'printer');
    return (
      <div className="rf-bar" aria-live="polite">
        <Group
          count={view.machines.length}
          kinds={view.machines.map((m) => m.kind)}
        />
        {printers.length > 0 && (
          <Books
            state={state}
            chosen={printers.map((m) => m.book)}
            busy={busy}
            onBook={a.onBook}
          />
        )}
        <div className="rf-bar-actions">
          <Action
            icon={<RotateCw size={16} />}
            label="Rotate"
            keys="R"
            onClick={a.onRotate}
          />
          <Action
            icon={<Copy size={16} />}
            label="Copy"
            keys="⌘C"
            onClick={a.onCopy}
          />
          <Action
            icon={<Trash2 size={16} />}
            label="Delete"
            keys="Del"
            tone="danger"
            onClick={a.onDelete}
          >
            <Price amount={view.refund} sign="+" />
          </Action>
        </div>
      </div>
    );
  }
  // Nothing held or selected: the floor speaks for itself.
  if (!view.canPaste)
    return <div className="rf-bar is-empty" aria-live="polite" />;
  return (
    <div className="rf-bar is-idle" aria-live="polite">
      <div className="rf-bar-actions">
        <Action
          icon={<ClipboardPaste size={16} />}
          label="Paste"
          keys="⌘V"
          onClick={a.onPaste}
        />
      </div>
    </div>
  );
}
function Text({
  name,
  does,
  status,
}: {
  name: string;
  does?: string;
  status?: keyof typeof STATUS_WORD | null;
}) {
  return (
    <div className="rf-bar-text">
      <b>
        {name}
        {status && (
          <span className={`rs-status is-${status}`}>
            {STATUS_WORD[status]}
          </span>
        )}
      </b>
      {does && <small>{does}</small>}
    </div>
  );
}

function Group({
  count,
  kinds = [],
}: {
  count: number;
  kinds?: MachineKind[];
}) {
  return (
    <>
      <span className="rf-bar-glyph" aria-label={`${count} machines`}>
        <b>{count}</b>
      </span>
      <div className="rf-bar-kinds" aria-hidden="true">
        {[...new Set(kinds)].slice(0, 6).map((kind) => (
          <MachineIcon key={kind} kind={kind} />
        ))}
      </div>
    </>
  );
}

function Books({
  state,
  chosen,
  busy,
  onBook,
}: {
  state: ScratchState;
  chosen: (PackId | undefined)[];
  busy: boolean;
  onBook: (book: PackId) => void;
}) {
  return (
    <div className="rf-books" aria-label="Printed book">
      {PACKS.filter((p) => packOpen(state, p.id)).map((p) => {
        const rank = bookLevel(state, p.id),
          top = printLevel(state, p.id),
          label = `${p.name}, level ${rank}, difficulty ${LEVEL_NAMES[top]}`;
        return (
          <button
            key={p.id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={chosen.every((b) => b === p.id)}
            className={chosen.some((b) => b === p.id) ? 'is-some' : ''}
            disabled={busy}
            onClick={() => onBook(p.id)}
          >
            <img src={TICKET_ART[p.id].small} alt="" />
            <i className="rs-book-level">{rank}</i>
          </button>
        );
      })}
    </div>
  );
}
