'use client';
import { useState, type ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import type { User } from '@/lib/online/types';
import { AccessForm, RecoveryCode, type AccessMode } from './account-forms';
import './join-sheet.css';

/**
 * The one place a guest is asked to join, opened only when they choose to:
 * from the end of a rated game, the leaderboard or the account button.
 * Joining keeps the guest's results, so the place they just earned is theirs.
 */
export function JoinSheet({
  open,
  onOpenChange,
  context,
  mode = 'signup',
  onJoined,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One short line on what joining keeps, e.g. the rating just earned. */
  context?: ReactNode;
  mode?: AccessMode;
  onJoined?: (user: User) => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  function close(next: boolean) {
    if (next) return onOpenChange(true);
    // Closing after joining still finishes the step it was opened for.
    if (user) onJoined?.(user);
    setCode(null);
    setUser(null);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="join-sheet">
        <div className="join-medal" aria-hidden="true">
          <span>
            <Trophy />
          </span>
        </div>
        {code && user ? (
          <>
            <DialogTitle className="join-title">
              Welcome, {user.name}
            </DialogTitle>
            <DialogDescription className="join-context">
              Your name is on the board.
            </DialogDescription>
            <RecoveryCode code={code} onDone={() => close(false)} />
          </>
        ) : (
          <>
            <DialogTitle className="join-title">
              {mode === 'login' ? 'Welcome back' : 'Join the leaderboard'}
            </DialogTitle>
            <DialogDescription className="join-context">
              {context ?? 'Your games so far come with you.'}
            </DialogDescription>
            <AccessForm
              initialMode={mode}
              focusFirst
              onSignedIn={(signedIn, recoveryCode) => {
                setUser(signedIn);
                if (recoveryCode) setCode(recoveryCode);
                else {
                  onJoined?.(signedIn);
                  setUser(null);
                  onOpenChange(false);
                }
              }}
              footer={
                <p className="join-fine">
                  Only your name and results are public. Your email stays private.
                </p>
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
