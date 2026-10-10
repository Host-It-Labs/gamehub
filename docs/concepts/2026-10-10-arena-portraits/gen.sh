#!/bin/zsh
# usage: gen.sh <prompt-file> <output-png> <log>
# One image per run, at most 25 minutes; the copy is accepted only if the
# run's own session folder holds exactly one PNG with the same hash.
cd /Users/williamguinaudie/Documents/code/gamehub
CODEX=$(command -v codex || echo /Users/williamguinaudie/.nvm/versions/node/v22.22.0/bin/codex)
LUNA=$(node .claude/skills/artwork/newest-luna.mjs)
P=$(cat "$1")
perl -e 'alarm 1500; exec @ARGV' "$CODEX" exec --skip-git-repo-check --sandbox workspace-write -m "$LUNA" -c model_reasoning_effort='"low"' '$imagegen Call the built-in image generation tool exactly once with the prompt below, exactly as written. It is final: do not rewrite, restructure, expand or shorten it, and do not ask questions. The output_hint field of the result names the saved PNG: print only that field, never the image data, then copy that file to the exact absolute path: '"$PWD/$2"'. Never call the image tool a second time. Prompt: '"$P" < /dev/null > "$3" 2>&1
SID=$(grep -m1 '^session id:' "$3" | awk '{print $3}')
DIR=~/.codex/generated_images/$SID
N=$(ls "$DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
if [ -z "$SID" ] || [ "$N" != 1 ]; then echo "WRAPPER FAIL: $N images in $DIR" >> "$3"; echo "fail $2 ($N images)"; exit 1; fi
SRC=$(ls "$DIR"/*.png)
[ -f "$2" ] || cp "$SRC" "$2"
if [ "$(shasum -a 256 < "$SRC")" != "$(shasum -a 256 < "$2")" ]; then echo "WRAPPER FAIL: hash mismatch $SRC" >> "$3"; mv "$2" "$2.mismatch"; cp "$SRC" "$2"; fi
echo "WRAPPER source $SRC" >> "$3"; echo "ok $2"
