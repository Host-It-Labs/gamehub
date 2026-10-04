#!/bin/zsh
# usage: recover.sh <log>...
# Makes each output file the PNG its own Codex run generated, taken from
# ~/.codex/generated_images/<session>/. Luna sometimes lost its output_hint and
# either copied nothing or searched for "a recent PNG" and copied another
# parallel run's image (29 September 2026). A wrong copy is moved aside to
# docs/concepts/2026-10-02-alto-space/wrong/; a missing one is copied from the run's own session folder.
# Also reports how many PNGs each run made (the skill expects exactly one).
setopt null_glob
mkdir -p docs/concepts/2026-10-02-alto-space/wrong
for LOG in "$@"; do
  OUT=$(grep -o 'exact absolute path: [^ ]*\.png' "$LOG" | head -1 | sed 's/exact absolute path: //')
  SID=$(grep -m1 '^session id:' "$LOG" | awk '{print $3}')
  PNGS=(~/.codex/generated_images/$SID/*.png)
  N=${#PNGS}
  STATE=ok
  if [[ -e "$OUT" && ( $N == 0 || "$(md5 -q "$OUT")" != "$(md5 -q "${PNGS[1]}")" ) ]]; then
    mv "$OUT" "docs/concepts/2026-10-02-alto-space/wrong/$(basename "$OUT" .png)-$(date +%s).png"
    STATE=wrong-copy-moved
  fi
  if [[ ! -e "$OUT" ]]; then
    if [[ $N == 1 ]]; then cp "${PNGS[1]}" "$OUT"; STATE="$STATE recovered"; else STATE="$STATE missing"; fi
  fi
  echo "$(basename "$OUT") session=$SID pngs=$N $STATE"
done
