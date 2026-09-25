#!/bin/zsh
# Usage: run.sh <key> <variant>  — one fresh generation per call.
cd /Users/williamguinaudie/Documents/code/gamehub
KEY=$1; V=$2
OUT=/Users/williamguinaudie/Documents/code/gamehub/public/art/lucky/$KEY-v1-$V.png
[ -e "$OUT" ] && { echo "exists $OUT"; exit 1; }
PROMPT=$(node -e "import('./docs/concepts/2026-09-25-lucky-tickets/prompts.mjs').then(m=>{const [s,p]=m.PROMPTS['$KEY'];process.stdout.write('Size: '+s+'. '+p)})")
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
"$CODEX" exec -m gpt-6-astra --skip-git-repo-check --sandbox workspace-write "\$imagegen Generate this image using the built-in image generation tool, newest model, highest quality. Save the final PNG to the exact absolute path: $OUT. Do not edit or retouch it afterwards and do not make a second pass. Prompt: $PROMPT" > docs/concepts/2026-09-25-lucky-tickets/log-$KEY-$V.txt 2>&1
ls -la "$OUT"
