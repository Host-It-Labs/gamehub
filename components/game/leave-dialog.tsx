'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import './leave-dialog.css';

/** Never hold the player on the dialog for longer than this. */
const SETTLE_MS = 4000;

/**
 * Leaving a game that keeps your progress (saved board-game matches, online
 * seats, Folio runs): `ask(go)` opens the leave dialog; Leave waits for
 * anything still in flight (`settle`), then calls `go` (or the dialog's own
 * `onLeave` when `ask` had none). `leavesPage`: `go` loads another page, so
 * the dialog stays up until the browser replaces it.
 */
export function useLeaveDialog(
  settle: () => Promise<unknown> = () => Promise.resolve(),
) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ go: () => void; leavesPage: boolean } | null>(null);
  const latest = useRef(settle);
  useEffect(() => {
    latest.current = settle;
  });
  const ask = useCallback((go?: () => void, leavesPage = false) => {
    pending.current = go ? { go, leavesPage } : null;
    setOpen(true);
  }, []);
  const leave = useCallback(
    (fallback?: () => void, fallbackLeavesPage = false) => {
      const next =
        pending.current ??
        (fallback ? { go: fallback, leavesPage: fallbackLeavesPage } : null);
      if (!next) return;
      setBusy(true);
      const timeout = new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      void Promise.race([latest.current().catch(() => {}), timeout]).then(
        () => {
          next.go();
          if (next.leavesPage) return;
          pending.current = null;
          setBusy(false);
          setOpen(false);
        },
      );
    },
    [],
  );
  const close = useCallback((next: boolean) => {
    if (!next) setOpen(false);
  }, []);
  return { open, busy, ask, leave, close };
}

/** One leave dialog for every game: it says the game is already saved, and
 *  its buttons never swap: Leave first, Keep playing second. */
export function LeaveDialog({
  state,
  title,
  saved,
  theme,
  onLeave,
  leavesPage = false,
  children,
}: {
  state: ReturnType<typeof useLeaveDialog>;
  title: string;
  /** What is kept, said plainly: "Your match is saved on this device." */
  saved: string;
  /** The game's world, as for `GameMenu` (nox, mora, yata, folio). */
  theme?: string;
  /** What Leave does when `ask` was called without it. */
  onLeave?: () => void;
  leavesPage?: boolean;
  /** Rarer actions (the host's End for everyone), after the two buttons. */
  children?: ReactNode;
}) {
  return (
    <Dialog open={state.open} onOpenChange={state.close}>
      <DialogContent
        className="leave-dialog"
        data-leave-theme={theme}
        showCloseButton={false}
      >
        <span className="leave-saved-mark" aria-hidden="true">
          <Check />
        </span>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="leave-saved">{saved}</DialogDescription>
        <div className="leave-actions">
          <button
            type="button"
            className="leave-go"
            disabled={state.busy}
            onClick={() => state.leave(onLeave, leavesPage)}
          >
            Leave
          </button>
          <button
            type="button"
            className="leave-stay"
            disabled={state.busy}
            onClick={() => state.close(false)}
          >
            Keep playing
          </button>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
