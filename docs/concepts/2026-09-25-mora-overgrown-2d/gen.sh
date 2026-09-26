#!/bin/zsh
# usage: gen.sh <prompt-file> <output-png>   (one fresh built-in generation, no reference images)
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
cd /Users/williamguinaudie/Documents/code/gamehub
PROMPT=$(cat "$1")
"$CODEX" exec -m gpt-6-astra --skip-git-repo-check --sandbox workspace-write "\$imagegen Generate this image using the built-in image generation tool, newest model, highest quality, largest native size for the stated orientation, PNG. Do not open, view or use any existing image file; this is a fresh generation, never an edit. Save the final image to the exact absolute path: $2. Prompt: $PROMPT" < /dev/null > "$2.log" 2>&1
ls -la "$2" 2>&1
