The parallel gateway splits the pipeline in two, and the split is the point:

- **Mechanical validation** — anything a machine can settle on its own, with a
  reproducible verdict: block schema and constraint rules, label prefixes,
  syntax, spelling, cross-references and citation resolution, Lean build and
  proof status, LaTeX compilation, FHIR/SUSHI validation, QA axes. No
  judgement, no negotiation; it passes or it does not.
- **Non-mechanical validation** — everything that needs judgement: is the claim
  accurate, does the prose keep the folio's voice, does the change actually say
  what the editor meant. A **review agent** handles the routine cases; anything
  turning on clinical or scientific judgement escalates to a **human reviewer or
  SME**. Both branches are the *same* stage of the pipeline — the reviewer being
  a person or an agent changes who answers, not where the answer goes.

Both branches must report before the join. A green mechanical run does not
excuse a missing review, and a clean review does not excuse a red build.
