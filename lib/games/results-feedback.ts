/** A missing seat is a spectator, never the first player by default. */
export function viewerWon(
  viewer: number | null | undefined,
  winners: readonly number[],
) {
  return (
    viewer != null &&
    Number.isInteger(viewer) &&
    viewer >= 0 &&
    winners.includes(viewer)
  );
}

/** Nox counts penalties; the other strategy games count points. Ties all win. */
export function winningSeats(scores: readonly number[], lowestWins = false) {
  if (!scores.length || scores.some((score) => !Number.isFinite(score)))
    return [];
  const best = lowestWins ? Math.min(...scores) : Math.max(...scores);
  return scores.flatMap((score, seat) => (score === best ? [seat] : []));
}

/** A final result is announced once per match, when its presentation opens.
 * Closing a dialog, polling, changing volume or Strict Mode replay cannot
 * repeat it. A muted presentation is consumed too, so unmuting stays quiet. */
export function createResultsFeedback() {
  let announced = false;
  return {
    update(finished: boolean, visible: boolean, volume: number) {
      if (!finished) announced = false;
      if (!finished || !visible || announced) return false;
      announced = true;
      return Number.isFinite(volume) && volume > 0;
    },
  };
}

/** Deferring consumption lets a cancelled React effect (including Strict Mode's
 * setup/cleanup probe) leave the real presentation eligible to play. */
export function scheduleResultsFeedback(
  feedback: ReturnType<typeof createResultsFeedback>,
  finished: boolean,
  visible: boolean,
  volume: number,
  announce: () => void,
) {
  if (!finished || !visible) {
    feedback.update(finished, visible, volume);
    return;
  }
  const timer = setTimeout(() => {
    if (feedback.update(finished, visible, volume)) announce();
  }, 0);
  return () => clearTimeout(timer);
}
