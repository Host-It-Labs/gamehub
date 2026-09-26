#!/bin/zsh
# usage: gen.sh <prompt-file> <output-png> <log>
cd /Users/williamguinaudie/Documents/code/gamehub
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
P=$(cat "$1")
MSG='$imagegen Generate this image using the built-in image generation tool. Do not edit or revise any image; make exactly one generation and save it as is. Save the final image to the exact absolute path: '"$2"'. Prompt: '"$P"
"$CODEX" exec -m "${CODEX_MODEL:-gpt-6-astra}" --skip-git-repo-check --sandbox workspace-write "$MSG" < /dev/null > "$3" 2>&1
echo "exit $? $2"; ls -la "$2" 2>&1
