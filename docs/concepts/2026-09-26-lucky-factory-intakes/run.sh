#!/bin/zsh
# Usage: run.sh <key> <variant>  — one fresh generation per call (one image).
# A failed attempt is renamed to <key>-v2-<variant>-fail-N.png first, then this
# is run again with the same prompt. Run it outside the command sandbox:
# Codex needs the network.
cd /Users/williamguinaudie/Documents/code/gamehub
KEY=$1; V=$2
DIR=/Users/williamguinaudie/Documents/code/gamehub-art-archive/public/art/lucky/factory
OUT=$DIR/$KEY-v2-$V.png
LOGDIR=docs/concepts/2026-09-26-lucky-factory-intakes
[ -e "$OUT" ] && { echo "exists $OUT"; exit 1; }
mkdir -p "$DIR"
L=($LOGDIR/log-$KEY-$V*.txt(N)); N=${#L}
LOG=$LOGDIR/log-$KEY-$V.txt; [ "$N" -gt 0 ] && LOG=$LOGDIR/log-$KEY-$V-retry-$N.txt
PROMPT=$(node -e "import('./$LOGDIR/prompts.mjs').then(m=>{const [s,p]=m.PROMPTS['$KEY'];process.stdout.write('Size: '+s+'. '+p)})")
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
LUNA=$(node .claude/skills/artwork/newest-luna.mjs)
"$CODEX" exec --skip-git-repo-check --sandbox workspace-write -m "$LUNA" -c model_reasoning_effort='"low"' "\$imagegen Call the built-in image generation tool exactly once with the prompt below, exactly as written. It is final: do not rewrite, restructure, expand or shorten it, and do not ask questions. The output_hint field of the result names the saved PNG: print only that field, never the image data, then copy that file to the exact absolute path: $OUT. Never call the image tool a second time. Prompt: $PROMPT" < /dev/null > $LOG 2>&1
# If Codex could not copy outside its workspace, take the session's PNG.
SID=$(grep -m1 '^session id:' $LOG | awk '{print $3}')
PNGS=(~/.codex/generated_images/$SID/*.png(N))
echo "session $SID: ${#PNGS} png"
[ ! -e "$OUT" ] && [ ${#PNGS} -ge 1 ] && cp -n "${PNGS[1]}" "$OUT"
ls -la "$OUT"
