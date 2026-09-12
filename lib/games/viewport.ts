/** Portrait tables use the available height and pan sideways; landscape tables fit in full. */
export function illustratedBoardScale(
  boardWidth: number,
  viewportWidth: number,
  viewportHeight: number,
  portrait: boolean,
) {
  const heightScale = Math.max(
    0.01,
    (viewportHeight - 16) / ((boardWidth * 2) / 3),
  );
  return portrait
    ? heightScale
    : Math.max(0.01, Math.min((viewportWidth - 12) / boardWidth, heightScale));
}
