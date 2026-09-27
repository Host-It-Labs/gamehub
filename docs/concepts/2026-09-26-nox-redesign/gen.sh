#!/bin/zsh
# usage: gen.sh <prompt-file> <absolute-output-png> <log>
cd /Users/williamguinaudie/Documents/code/gamehub
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
LUNA=$(node .claude/skills/artwork/newest-luna.mjs)
P=$(cat "$1")
MSG='$imagegen Call the built-in image generation tool exactly once with the prompt below, exactly as written. It is final: do not rewrite, restructure, expand or shorten it, and do not ask questions. The output_hint field of the result names the saved PNG: print only that field, never the image data, then copy that file to the exact absolute path: '"$2"'. Never call the image tool a second time. Prompt: '"$P"
"$CODEX" exec --skip-git-repo-check --sandbox workspace-write -m "$LUNA" -c model_reasoning_effort='"low"' "$MSG" < /dev/null > "$3" 2>&1
echo "exit $? $2"; ls -la "$2" 2>&1
