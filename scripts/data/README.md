# Outfox factual sources

Run `python3 scripts/build-outfox-catalog.py` to regenerate the catalog from the
World Bank Indicators API. The checked-in catalog has 339 distinct cards drawn
from 30 indicators, with fixed 2023 observations and World Bank geographic groups.
Each card identifies its indicator, year, measurement unit, ordering direction,
reporting-economy scope, source page, API URL and retrieval date.

`outfox-worldbank-evidence.json` preserves the country metadata and observations
used for that build. Missing observations are excluded explicitly: cards rank
**reporting economies**, not an asserted complete census of countries. Territories
are included. The World Bank's current Middle East region also includes Afghanistan
and Pakistan, which cards disclose. Ties in the first six places are excluded so
that top-five ordering and fifth-place membership are unambiguous.

Bot decoys are seventh-ranked reporting economies. Human players supply their own
text; the engine rejects empty and duplicate entries but does not claim to validate
arbitrary user text against every real-world synonym or spelling.

World Bank data terms: https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets
