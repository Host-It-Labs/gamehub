#!/bin/zsh
# Usage: run.sh <key> <variant>  — one fresh generation per call.
# A failed attempt is renamed to <key>-v1-<variant>-fail-N.png first, then this
# is run again with the same prompt.
cd /Users/williamguinaudie/Documents/code/gamehub
KEY=$1; V=$2
DIR=/Users/williamguinaudie/Documents/code/gamehub-art-archive/public/art/lucky/factory
OUT=$DIR/$KEY-v1-$V.png
LOGDIR=docs/concepts/2026-09-25-lucky-factory
[ -e "$OUT" ] && { echo "exists $OUT"; exit 1; }
L=($LOGDIR/log-$KEY-$V*.txt(N)); N=${#L}
LOG=$LOGDIR/log-$KEY-$V.txt; [ "$N" -gt 0 ] && LOG=$LOGDIR/log-$KEY-$V-retry-$N.txt
PROMPT=$(node -e "import('./docs/concepts/2026-09-25-lucky-factory/prompts.mjs').then(m=>{const [s,p]=m.PROMPTS['$KEY'];process.stdout.write('Size: '+s+'. '+p)})")
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
"$CODEX" exec -m gpt-6-astra --skip-git-repo-check --sandbox workspace-write "\$imagegen Generate this image using the built-in image generation tool, newest model, highest quality. Save the final PNG to the exact absolute path: $OUT. Do not edit or retouch it afterwards and do not make a second pass. Prompt: $PROMPT" < /dev/null > $LOG 2>&1
ls -la "$OUT"
