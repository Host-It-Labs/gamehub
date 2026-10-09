#!/bin/zsh
# Usage: gen.sh <prompt-file> <absolute-output-png> <log>
cd /Users/williamguinaudie/Documents/code/gamehub
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
LUNA=$(node .claude/skills/artwork/newest-luna.mjs)
PROMPT=$(cat "$1")
"$CODEX" exec --skip-git-repo-check --sandbox workspace-write -m "$LUNA" -c model_reasoning_effort='"low"' "\$imagegen Call the built-in image generation tool exactly once with the prompt below, exactly as written. It is final: do not rewrite, restructure, expand or shorten it, and do not ask questions. The output_hint field of the result names the saved PNG: print only that field, never the image data, then copy that file to the exact absolute path: $2. Never call the image tool a second time. Prompt: $PROMPT" < /dev/null > "$3" 2>&1
echo "exit $?" >> "$3"
