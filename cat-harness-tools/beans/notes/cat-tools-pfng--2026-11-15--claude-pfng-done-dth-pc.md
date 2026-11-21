---
# note on cat-tools-pfng from claude/pfng-done-dth-pc
$schema: folio-bean-note/v1
bean: cat-tools-pfng
branch: "claude/pfng-done-dth-pc"
created: "2026-11-15"
---
## done dth-pc

no catalogues — `litlfred/dth-pc` has no `translations/` directory (`0` `.pot`/`.po` files), `dth-pc.json` declares no `translation-sources` or `user-scenario` (`processes/` is declared as `business-processes` with no locale opt-in), and `glossary/dth-pc.glossary.json` has `0` `"status": "authored"` terms (58 `"status": "candidate"` and 4 `"status": "could-not-extract"`). `translation:pot` / `translation:candidates` produce 0 templates; nothing to round-trip.
