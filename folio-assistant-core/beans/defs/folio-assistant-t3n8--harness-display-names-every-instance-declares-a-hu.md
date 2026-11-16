---
# folio-assistant-t3n8
$schema: bean/1.0.0
title: 'HARNESS DISPLAY NAMES: every instance declares a human title, and the schema should say so'
status: completed
type: bug
priority: normal
created_at: 2026-09-21T17:28:40Z
updated_at: 2026-09-21T22:08:02Z
parent: folio-assistant-yj32
---

Owner, 2026-09-21: "harnesses should list the names (they should be named in schmeas, e.g. cat-boostrap should be named 'Boostrap', f-a => Folio Assistant, cat-harness => C@T Harness)"

CORPUS CHECK, from docs/_data/harness.json — every instance's title is currently just its directory name, with one exception that is wrong: cat-harness declares 'title: folio-assistant', which collides with the root instance and made disambiguate() (scripts/harness-tiles.ts:462) qualify it to 'folio-assistant (cat-harness)'. The disambiguator behaved correctly.

This SUPERSEDES bean 28jx, which proposed fixing cat-harness's title alone. The owner asks for the general rule: a display title per instance, declared. Two things to settle — whether title becomes REQUIRED in the declaration schema (a default of 'name' is what let the collision through unnoticed), and whether disambiguate() stays as a backstop once titles are distinct by construction.



## Summary of Changes

Shipped in 58869ece and carried through the main merge in 73237866. Display
titles declared on four instances: Folio Assistant (folio-assistant.json),
C@T Harness (cat-harness/cat-harness.json), Bootstrap (bootstrap/bootstrap.json
— re-applied there after main renamed cat-bootstrap/), WHO IRIS
(who-iris/who-iris.json).

cat-harness's was WRONG rather than absent: it declared title
'folio-assistant', the root instance's name, so two instances carried one
title and disambiguate() correctly qualified the tab to 'folio-assistant
(cat-harness)' — the label the owner reported. The disambiguator behaved as
designed; the declaration was the defect. 28jx is scrapped in favour of this.

Marked completed 2026-09-21, late: the work shipped hours earlier and the
bean was left at todo, which the owner caught when a status claim was made
without evidence.
