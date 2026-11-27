---
# note on cat-tools-pfng from claude/pfng-done-dth-hrh
$schema: folio-bean-note/v1
bean: cat-tools-pfng
branch: "claude/pfng-done-dth-hrh"
created: "2026-11-15"
---
## done dth-hrh

no catalogues — `litlfred/dth-hrh` has 0 `.pot` / `.po` files (`translations/` holds only `.gitignore`), declares no `translation-sources`, `processes`, or `user-scenario` directory in `dth-hrh.json`, has 0 authored glossary terms (all 216 terms across `glossary/*.json` have `status: "candidate"`), and running `bun run cat translation:pot`, `translate-bpmn:extract`, `translate-user-scenarios`, and `glossary:pot` produces 0 templates (`translation:candidates` exits 2: declares no `translation-sources` directory). Per `cat-tools-pfng`, no catalogues were invented.
