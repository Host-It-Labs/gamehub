# Mora — woodland sanctuary

Six illustrated scoring habitats occupy two groups of woodland terraces. The die still restricts placement by row,
side or occupancy; the roller ignores the die but never capacity. Each illustrated
space holds exactly one creature. New creatures fill the spaces in a fixed order; Trail spaces are numbered, shared by the main board and opponent previews.

Scoring as of 27 September 2026 (simplified: no lone-creature points, no "echo" wording).

The Observatory (two rounds, 17 spaces):

| Place | Capacity | Scoring |
| --- | --- | --- |
| Courtyard | 4 | Largest group of one species: 2 / 6 / 11 / 17 for 1 / 2 / 3 / 4. |
| Garden | 4 | 8 per matching pair. |
| Hollow | 2 | Matching pair: 9. Anything else: 0. |
| Glasshouse | 3 | 3 each if its species lives in another habitat. |
| Channel | 3 | 2 per creature, any species. |
| Watchpost | 1 | 2 per other habitat holding its species, up to 10. |

Floodline Station (three rounds, 23 spaces):

| Place | Capacity | Scoring |
| --- | --- | --- |
| Pools | 5 | 7 per matching pair. |
| Beach | 5 | 3 per different species. |
| Mangroves | 3 | Three of one species: 12. Anything else: 0. |
| Pier | 4 | 2 each, +6 for A–B–A–B in placement order. |
| Cave | 4 | 3 each if its species lives in another habitat. |
| Lighthouse | 2 | 4 each if its species lives nowhere else on your board. |

The paragraphs below describe the earlier Herd/Variety/Trail board and are kept for history.

Trail replaces Exclusive: there is no need to reserve species from a pool of six.
Lookout replaces Mixed Trio: its resident watches for its own species across the map, making the chosen creature matter. All placements remain legal within die and
capacity restrictions, even if they score poorly.

Discard is the illustrated compost basket in the top-right forest rim. It consumes the chosen
creature and this turn, scores zero and is available on every die face. The
zone-5 move identifier and public history are retained for compatibility. Legacy
river contents score zero and do not activate Shared or Lookout.

Existing saves use the revised scoring. Trail uses the stored placement order.
Capacities now vary from one to four. Area indices, die positions and wire formats are unchanged. Older saves retain excess creatures in a small visible group beside the relevant habitat, and in the inspection text; new placements obey the smaller capacity. For legacy Lookouts with excess creatures, the first placed creature is the resident whose species scores.

## Presentation

A fresh dimensional woodland illustration supplies the terrain and all 17 creature spaces: moss nests, flower clearings, root hollows, stepping-stone terraces, a mushroom grove and one raised lookout. Habitat size and shape follow their capacity and character. Live creatures and compact labels follow measured image coordinates in `lib/games/trio/mora-map.ts`; the same geometry is used by solo, online and opponent boards. No central water separates the terraces. Other games retain their existing presentation. See [artwork provenance and prompt](artwork-mora-v10.md).

## Bot and verification

The bot uses the shared scoring function and a bounded completion search. Trail
search considers ordered continuations because neighbour order affects points.
The obsolete Exclusive discount has been removed. Regression cases cover Trail
order, Lookout species matching, Shared, discarding and endgame bot choices.

The prior balance sample applied to the previous rules and is no longer valid.
Human balance and browser/mobile/touch acceptance remain to be tested.

The landscape uses lifted shadows and softer contrast, with a light softening filter confined to the terrain; live labels and pieces remain sharp. Placement feedback is outline-only, without habitat or nest color fills. A small decorative woodland visitor follows the stair path, fireflies drift, and placed creatures occasionally stir. Ambient visitors are smaller than playing pieces, cannot be interacted with, and never affect scoring. Reduced-motion mode removes all ambient movement; mini boards remain still.
