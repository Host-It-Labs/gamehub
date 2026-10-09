#!/bin/zsh
# usage: batch.sh <name-variant>...   e.g. puzzles-square-a  (prompt = prompts/<name>.txt)
D=/Users/williamguinaudie/Documents/code/gamehub/docs/concepts/2026-10-09-puzzles-rota-diner-covers
for job in "$@"; do
  name=${job%-*}
  ( perl -e "alarm 900; exec @ARGV" $D/gen.sh $D/prompts/$name.txt $D/sources/$job.png $D/logs/$job.log || echo "fail/timeout $job" ) &
done
wait
echo BATCH DONE
