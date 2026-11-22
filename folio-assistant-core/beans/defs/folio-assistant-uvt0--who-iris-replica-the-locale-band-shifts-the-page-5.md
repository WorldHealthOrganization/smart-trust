---
# folio-assistant-uvt0
$schema: bean/1.0.0
title: 'who-iris replica: the locale band shifts the page 52px; make it an overlay (owner: no shift)'
status: completed
type: bug
priority: high
created_at: 2026-10-06T08:56:44Z
updated_at: 2026-10-06T14:30:00Z
parent: folio-assistant-4ccr
---

**Owner ruling, 2026-10-06** (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92), option 1 of 3: *"Overlay, no shift"*. The language band must not move the replica.

## The defect
When a who-iris replica page carries a `fa-translation-meta` block, `docs-ui.js` puts the locale globe in a band inside the page flow, between `.crumbs` and `<main>`. The band is 40 px tall and pushes `<main>` down by 52 px. The block is added at publish time by `mount-instance-docs.ts`, so the shift is already live on the published replica. #2229 adds the block to the generated pages too.

That breaks the replica-fidelity rule (bean `g9r2`): mounting the harness must not move, resize or recolour any element of the replica with the glass closed.

## How it was found, and why the test currently passes
#2229's `folio-mount.e2e.ts` fidelity test went red. The band counted as an extra sibling, so `MAIN[4]` became `MAIN[5]` and every "with" key came back undefined. To get #2229 green, its agent made BOTH sides of the comparison use a copy of the page with the translation block stripped. That is consistent with the split `mounted-locale.e2e.ts` already states, but it means the fidelity test no longer covers a translated page. The real shift is untested.

## Done when
- [x] the globe band on a replica page is an overlay (fixed or absolute, or in the existing handle/strip), not in the page flow; no element of the replica moves with the glass closed
- [x] `folio-mount.e2e.ts`'s fidelity test runs on a REAL translated replica page (block present) and passes; the stripped-page fixture stays only where a test needs a block-less page
- [x] MEASURED: the test fails on the in-flow band (revert the CSS, see it red)
- [x] rendered at 1280 and 390 in en and ar (rtl), screenshots to the owner


## Evidence (2026-10-06)
- On a replica page (`script[data-fa-folio-mount]`), `glassBandSlot` places the band as body's first child, marked `data-fa-band-overlay`; CSS fixes it to the top 2.25rem strip that body already reserves for the handle (bean `g9r2`). Non-replica pages are unchanged.
- The fidelity test now compares the real translated page with and without the mount. Restoring the old CSS and JS makes 2 folio-mount tests fail.
- Measured `<main>` top before → after: en 1280 404→352, en 390 654→602, ar 1280 453→401, ar 390 708→656. That is −52 px in every case, with no horizontal overflow.
- The locale control and the handle share the strip without touching. In ar-390 the control is at x 314–382 and the handle at x 151–239. Four new e2e cases cover en and ar at 1280 and 390.
- Screenshots of all eight cases (before/after × en/ar × 1280/390) were sent to the owner in the session.

## Merged 2026-10-06 (session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92)
#2277 merged as e11bc28 after CI PASS on f1ee624 (20 checks; every owed workflow ran).
