# Nox and multiplayer controls

Back in shared trio and party matches opens the existing dialog style, with Keep playing first, a warning that others may be waiting, and Leave table returning to My tables. Navigation retains membership; dismissing restores focus. Host Table floats below Back on the left, below modal overlays.

Fast passes 3/3/2/2/2 cards at 2–6 seats. Normal passes 3/4/3/3/2, about one quarter of the dealt hand bounded to 2–4. Existing saved exchange sizes remain authoritative. Existing shortened duel decks remain 15 Fast / 25 normal cards, with equal hands and the remainder reserved. Fast's marked 4 costs 10; normal's marked 8 costs 40. Tutorial text follows this change.

Nox has smaller tablet/phone seat tags, a wider compact tablet landscape shelf, Pass/Clear immediately above the portrait shelf, and separate Menu, Pass/Clear/Undo, and hand areas in short landscape. Desktop keeps its side confirmation plate. Source artwork and camera metadata are unchanged.

Validation: typecheck, lint, diff whitespace check, 33 focused engine/undo/direction tests and 16 multiplayer server tests passed. Simulations cover both decks, 2–6 players, shields, card conservation, bot legal moves, and exchange delivery. An old server fixture passing four cards in a two-player game was updated to the new three-card exchange.

No browser, physical iPad/phone, touch, zoom or visual acceptance was performed. Responsive CSS was inspected statically; long-name truncation retains full accessible names. Device fit remains to be checked interactively.
