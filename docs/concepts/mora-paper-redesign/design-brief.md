# Mora — paired paper-world redesign

Status: concept exploration, not integrated artwork or changed rules.

## User direction

The user selected portrait option A from the previous comparison, superseding that exploration's recommendation of B: one connected winding vertical landscape, not isolated habitat cards. Redesign desktop alongside portrait. Recover clearly layered paper materials across the entire environment, and make habitat identity and dice restrictions legible.

## Shared visual language

- Folded cardstock observatory with visible dome seams and a squared paper-paving courtyard.
- Elevated flower-filled roof garden with a low folded-paper parapet.
- Dark corrugated-paper root hollows with a strong tunnel silhouette.
- Long accordion-fold greenhouse and ordered trail, rather than another round terrace.
- Continuous dry creek made from stacked angular grey card, not realistic stones or water.
- Tall timber-coloured folded-paper lookout, complete hut and base visible.
- Cut-paper forest and stacked contour terrain connect the habitats. Matte fibres, cut edges, folds and layered shadows should read across buildings and ground as well as trees.

Desktop and portrait share identities, rules and materials, but have separately authored compositions. Portrait keeps all six habitats and Release on screen without board scrolling. It is not a squeezed desktop crop. Existing source/crop coordinates must not be reused blindly for either new composition.

## Dice mapping: preserve rules, repair the visual connection

The current engine defines the following static memberships. Its die rules refer to habitat symbols, while the current display no longer carries those group glyphs. Restore the relationship in concepts through small shape stamps directly beside habitat labels and an identical symbol on the die.

| Habitat | Capacity | Field △ | Remote ● | Open ☀ | Sheltered ⌂ |
| --- | ---: | :---: | :---: | :---: | :---: |
| Courtyard | 4 | ✓ | | ✓ | |
| Roof garden | 4 | ✓ | | ✓ | ✓ |
| Root hollows | 2 | ✓ | | | ✓ |
| Glasshouse trail | 3 | | ✓ | ✓ | |
| Dry channel | 3 | | ✓ | ✓ | ✓ |
| Watchpost | 1 | | ✓ | | ✓ |

Open and Sheltered overlap: neither artwork nor a legend should pretend they are opposites. These labels remain semantically imperfect; the current concepts preserve them rather than silently change rules. A future naming pass could replace ambiguous category names with clearly named emblems, subject to approval.

Shape is the primary cue; colour is supporting information only. Distinguish the solid-circle Remote emblem from the hollow-ring Empty condition. Final production glyphs and text must be crisp DOM/vector UI, not image-generated lettering.

### Proposed interaction refinement, not implemented by this exploration

The existing board already computes legal destinations after creature selection (`components/game/boards.tsx`), and die help already names destinations and explains the roller exemption (`components/game/die.tsx`). The proposal makes the connection visible on the board before opening help; it is not a claim that legality checks are missing.

- On a static-group roll, repeat its emblem beside the short instruction and outline matching eligible habitats.
- With a creature selected, highlight only destinations that are actually legal: capacity still applies, and New species depends on that creature.
- Empty and New species are state-dependent conditions, not permanent painted map regions.
- The roller ignores the die restriction but still respects capacity. Their instruction should explicitly say they may use any habitat with space.
- Release remains available regardless of die and earns no points.
- Habitat inspection provides the scoring rule; dice help explains restriction membership. Avoid conflating the two.
- Preserve visible labels and capacity information when highlighting; do not use colour alone or obscure slots.

## Concept acceptance versus implementation acceptance

Generated images communicate material and composition direction. Painted slot counts, tiny emblems and text require inspection and may be imperfect. They do not establish target alignment, touch sizes, browser layout, fullscreen support or complete extension UI coverage. No engine or app code is changed by this exploration.

Before integration, define each composition's own coordinate contract, measure every slot and complete landmark, and verify all capacities (4/4/2/3/3/1), trail order and Release access. Test real eligibility, roller exemption, full/empty hand stability, goals and independent extension actions. Perform separate browser and touch checks with permission.
