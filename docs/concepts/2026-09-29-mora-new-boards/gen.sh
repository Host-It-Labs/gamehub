#!/bin/zsh
# usage: gen.sh <prompt-file> <absolute-output-png>   one fresh built-in generation, no reference images
# The image is taken from this run's own ~/.codex/generated_images/<session id>/ folder: parallel runs
# without an output_hint were seen copying another run's newest image (29 September 2026).
PROMPT_FILE=$(cd "$(dirname "$1")" && pwd)/$(basename "$1"); set -- "$PROMPT_FILE" "$2"; cd /Users/williamguinaudie/Documents/code/gamehub
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
LUNA=$(node .claude/skills/artwork/newest-luna.mjs)
PROMPT=$(cat "$1") || exit 1; [ -n "$PROMPT" ] || { echo "empty prompt $1"; exit 1; }
"$CODEX" exec --skip-git-repo-check --sandbox workspace-write -m "$LUNA" -c model_reasoning_effort='"low"' "\$imagegen Call the built-in image generation tool exactly once with the prompt below, exactly as written. It is final: do not rewrite, restructure, expand or shorten it, and do not ask questions. The output_hint field of the result names the saved PNG: print only that field, never the image data, then copy that file to the exact absolute path: $2. Never call the image tool a second time. Prompt: $PROMPT" < /dev/null > "$2.log" 2>&1
SID=$(grep -m1 'session id:' "$2.log" | awk '{print $NF}')
OWN=$(ls -t "$HOME/.codex/generated_images/$SID"/*.png 2>/dev/null | head -1)
[ -n "$OWN" ] && cp "$OWN" "$2"
ls -la "$2" 2>&1
