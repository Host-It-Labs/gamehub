# Ranking view and global navigation

- Topic selection restores each previously visited private ranking, including after save/reload. Draft caches are redacted for opponents and spectators and reset each round.
- Refresh from a selected topic opens the first fresh topic in the ranking view. Refresh from the initial chooser keeps the chooser. The two-per-round limit remains enforced by the engine.
- Compact topic buttons show titles and all five answer chips without category headings. Rank/lock content uses available height; short landscape places choices beside the list. Detailed comparisons open in a dialog.
- Party games and standalone worlds share GameNavigation: back/name left, Menu/Others/time right. The trio toolbar retains its right-side controls; practice time is now on the right too.
- AGENTS.md, docs/DESIGN.md and the game-world-layout skill establish the contract for every game family.

Validation: typecheck, lint, production build and 14 focused ranking/online tests pass. Full suite: 188/189 passed; the game-box source-text assertion in standalone-games.test.mjs fails against concurrent game-box work. No game-box code was changed for this task. The skill frontmatter was validated using js-yaml because the Python validator's PyYAML dependency was unavailable.

Browser and touch checks were not run. Responsive CSS is implemented but viewport fit is not visually verified. Scroll fallbacks remain available rather than clipping controls: extreme-size game containers, Atlas clue details, expanded sources and practice text, and inspection dialogs. Check long topic labels, maximum players, portrait/short landscape, zoom and ranking/refresh/reveal states in a browser before claiming no-scroll acceptance.
