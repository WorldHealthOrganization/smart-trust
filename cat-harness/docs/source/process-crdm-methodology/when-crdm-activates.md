An agent enters the CRDM workflow when it recognises that a request is about
**platform capability** rather than **folio content**. The triggers are:

1. **Explicit feature request** — the user says "I need a new block kind", "add
   a QA check for X", "the renderer should support Y". These are unambiguous.

2. **GitHub issue tagged as a feature or enhancement** — when the agent is asked
   to resolve an issue whose labels or body describe new functionality rather
   than a content edit.

3. **Discussion-derived need** — during an authoring session, the user
   encounters a limitation. The conversation shifts from "write this chapter" to
   "the platform should be able to do X". The agent detects this shift.

4. **Schema or pipeline change** — a request that would modify files under
   `schemas/`, `content/pipeline/`, `adapters/`, or `src/` rather than under a
   folio's `content/<paper>/`.

5. **Cross-cutting concern** — the request affects multiple folios or multiple
   content types. A single-folio content edit does not trigger CRDM; a change
   to how all folios validate does.

**The detection rule:** if implementing the request would require changes to
folio-assistant (the platform repository) rather than to a folio repository, the
request is a feature, and the agent should enter CRDM rather than coding
directly.

When the agent detects a CRDM trigger, it should:

1. **Acknowledge** — tell the user it has recognised a feature request
2. **Cite the source** — link to the issue, message, or conversation turn
3. **Propose entering the CRDM workflow** — explain what that means (structured
   requirements gathering before implementation)
4. **Get consent** — the user may prefer to skip the methodology for small
   changes; the agent respects that but notes the risk
