# Lucky — ticket books, prize symbols and covers (25 September 2026)

Fresh text-only generations with Codex `$imagegen` (`gpt-6-astra`; the default
`gpt-6-sol` is refused for this ChatGPT account since the Headroom proxy was
removed), two variants per image, all launched in parallel by `run.sh`. The
exact prompt of every image is in `prompts.mjs` (the size line is prepended);
Codex logs are kept as `log-*.txt`. Source PNGs live in the art archive
(`../gamehub-art-archive/public/art/lucky/`), not in git.

Every ticket prompt asks for one die-cut ticket, face-on, on a transparent
background, with the exact book title and one empty flat panel for the
game's own scratch grid. Transparency came through on every ticket and on the
symbol sheet.

| Image        | Chosen | Notes                                                                                                              |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| Lucky Seven  | A      | fairground stub ticket; B very close                                                                               |
| Twins        | A      | twin art deco arches, wide panel                                                                                   |
| Garden       | A      | scalloped seed packet; larger panel than B                                                                         |
| Ladder       | A      | tall Swiss-poster tower with a ladder motif                                                                        |
| Gold Mine    | A      | riveted octagon; larger panel than B                                                                               |
| Sun & Moon   | B      | round medallion; larger panel than A                                                                               |
| Sea Chart    | A      | B has a grey smudge inside its panel                                                                               |
| Crown Jewels | A      | jewelled shield                                                                                                    |
| Symbols      | A      | 16 glossy prize symbols; rebuilt with gutters by the script because a few symbols overlap the generated grid lines |
| Square cover | A      | "Lucky" spelled correctly, title inside the central 84%, ticket spread of five shapes                              |
| Wide lid     | A      | returned natively at 2172×724 (3:1); title fully inside the band. B's title sits lower                             |

All titles are spelled correctly and no image has extra lettering. Panels
were measured by flood fill (`scripts/optimize-lucky-art.mjs`) and checked by
overlay; every measured rectangle matches its painted panel.
