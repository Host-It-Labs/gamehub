#!/bin/zsh
# usage: gen.sh <prompt-file> <output-png> <log>
# One image per Codex run (artwork skill): newest Luna, low effort, stdin closed,
# killed after 15 minutes so a hung run always ends.
cd /Users/williamguinaudie/Documents/code/gamehub
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
LUNA=$(node .claude/skills/artwork/newest-luna.mjs)
P=$(cat "$1")
OUT="$2"
if [[ -e "$OUT" ]]; then echo "refusing to overwrite $OUT"; exit 2; fi
MSG='$imagegen Call the built-in image generation tool exactly once with the prompt below, exactly as written. It is final: do not rewrite, restructure, expand or shorten it, and do not ask questions. The output_hint field of the result names the saved PNG: print only that field, never the image data, then copy that file to the exact absolute path: '"$OUT"'. Never call the image tool a second time. If the result has no output_hint, do not search for or copy any other file; just stop. Prompt: '"$P"
"$CODEX" exec --skip-git-repo-check --sandbox workspace-write -m "$LUNA" -c model_reasoning_effort='"low"' "$MSG" < /dev/null > "$3" 2>&1 &
PID=$!
( sleep 900; kill $PID 2>/dev/null && echo "TIMEOUT after 900s" >> "$3" ) &
WD=$!
wait $PID
CODE=$?
kill $WD 2>/dev/null
echo "exit $CODE $OUT"
# Make sure the file is this run's own image (see recover.sh).
docs/concepts/2026-09-29-alto/recover.sh "$3"
