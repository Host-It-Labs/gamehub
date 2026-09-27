#!/bin/zsh
# usage: gen.sh <prompt-file> <output-png>   one fresh built-in generation, newest Luna at low effort, no reference images
cd /Users/williamguinaudie/Documents/code/gamehub
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
LUNA=$(node .claude/skills/artwork/newest-luna.mjs)
PROMPT=$(cat "$1")
LOG="docs/concepts/2026-09-27-mora-phone-boards/logs/$(basename "$2" .png).log"
[ -e "$2" ] && { echo "refusing to overwrite $2"; exit 1; }
"$CODEX" exec --skip-git-repo-check --sandbox workspace-write -m "$LUNA" -c model_reasoning_effort='"low"' "\$imagegen Call the built-in image generation tool exactly once with the prompt below, exactly as written. It is final: do not rewrite, restructure, expand or shorten it, and do not ask questions. The output_hint field of the result names the saved PNG: print only that field, never the image data, then copy that file to the exact absolute path: $PWD/$2. Never call the image tool a second time. Prompt: $PROMPT" < /dev/null > "$LOG" 2>&1
ls -la "$2" 2>&1
