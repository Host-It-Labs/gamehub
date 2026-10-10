#!/bin/zsh
# Launch both variants of every v14 image in parallel; ends when all have.
cd /Users/williamguinaudie/Documents/code/gamehub
D=docs/concepts/2026-10-10-arena-portraits
for f in $D/prompts/*.txt; do
  id=${f:t:r}
  for v in a b; do
    case $id in
      cover-square) out=assets/arena/concepts/box-arena-square-v6-$v.png ;;
      cover-wide) out=assets/arena/concepts/box-arena-wide-v6-$v.png ;;
      *) out=assets/arena/cards/card-$id-v14-$v.png ;;
    esac
    [ -f "$out" ] && continue
    $D/gen.sh $f $out $D/logs/$id-$v.log &
    sleep 1
  done
done
wait
echo ALL DONE
