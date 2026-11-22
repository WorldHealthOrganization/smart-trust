`uses[]` lists the blocks a **reader** must already have read to follow this
one. It is an editorial judgement; nothing derives it.

A paper folio has a second, machine-derived dependency graph (from
`lean.ref`); a document folio does not. So `uses[]` is the *only* dependency
signal, and every ordering metric, every "what else changes if this changes?"
question, and the reading-order review read it. List direct neighbours only.

---
