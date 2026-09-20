# Party refinements — 20 September 2026

Implemented Top Tier player counts and individual/team modes, factual Outfox,
shared-task Atlas geography replacement, setup Learn cleanup, list dragging,
and animated result rows. Existing unrelated checkout work was preserved.

- Individual mode: 2–6 players. Team mode: exactly two equal teams at 4 or 6.
- Outfox: 339 sourced 2023 World Bank cards; exactly two offers; typed decoy;
  factual order plus fake identification; values, scope and source at reveal.
- Atlas: six shared tasks drawn from 62 familiar capital locations; identical
  prompts and scoring for all participants; no speed advantage or asymmetric
  questions. Globe locations and paths appear after the final lock.
- Local and online practice, real starts, shared team drafts, private individual
  drafts, reconnects, spectator filtering and complete matches are covered.
- Old rules markers are rejected: retired racing/preference saves cannot run
  under the changed rules.

Validation: all 169 tests pass, including HTTP/SSE; full type checking, lint
and the production build pass (including static prerendering). Source evidence tests compare every Outfox value with the saved API data.
Geography tests verify identical tasks, identical-answer scoring, two teams,
lock ordering, hidden drafts, six-round completion and great-circle edge cases.

Browser, touch, visual layout and WebGL/GPU behavior were not exercised. The
user's instructions require explicit authorization for browser/computer-use
checks; no such checks were requested. Pointer and keyboard handlers, rendering
fallbacks and reduced-motion paths are implemented but not visually accepted.
