---
# folio-assistant-ajx9
$schema: bean/1.0.0
title: 'WHO IG CHROME: the blue bar, DRAFT watermark and publish box, ingested from the template chain rather than transcribed'
status: completed
type: feature
priority: normal
created_at: 2026-09-23T19:56:03Z
updated_at: 2026-09-26T03:54:14Z
parent: folio-assistant-yj32
---

Owner, 2026-09-23, chose "All three, fetch HL7's base template" and "smart-base, inherited".

Finishes what 0818 left open: the WHO visual styling, a different question from the menu it shipped.

## The template chain is three layers, and the three items do not come from one of them

    smart-trust local-template  ->  who.template.root 0.5.0  ->  fhir.base.template 1.0.0

- BLUE BAR is WHO's: --navbar-bg-color: #00477d (who.css:7). WHO navy, NOT the #0093D5 the avatars use.
- DRAFT WATERMARK is WHO's: an inline SVG tile at who.css:567, rotate(-35), rgba(245,45,45,0.5), Arial bold 20px, background-size calc(50% / 5) 100px repeat-x. Markup is <div id=ig-status class=ig-status-{status}> in includes/fragment-pagebegin.html:92, driven by site.data.fhir.ig.status. smart-trust is status: draft, version 1.8.0, releaseLabel ci-build.
- YELLOW PUBLISH BOX IS NOT WHO'S. who.css styles no #publish-box at all. --publish-box-bg-color: yellow and --publish-box-border: 1px solid #0A0008 are HL7's (project.css:64-65), INHERITED unchanged. Mirroring it mirrors HL7, and the record should say so.

## Measured overlay: 9 overridden, 5 WHO-only, 17 inherited

WHO overrides --btn-active-color, --btn-hover-color, --footer-bg-color, --footer-container-bg-color, --ig-header-color, --ig-status-text-color, --navbar-bg-color, --toc-box-bg-color, --toc-box-border. WHO-only: --display-todo, --showtodo, --must-color, --should-color, --may-color.

## The overlay is NOT a variable merge — one name carries two TYPES

--toc-box-border is "1px solid navy" in HL7 and "navy" in WHO. WHO's own rules read it as a colour (who.css:499 "border: 2px solid var(--toc-box-border)"); HL7's read it as a shorthand (project.css:575 "border: var(--toc-box-border)"). In a WHO IG that HL7 rule resolves to "border: navy", which is invalid. A naive merge of the two sets therefore ships a broken rule, and this must be RECORDED as a conflict rather than silently resolved.

## Approach: mirror the ig-menu precedent exactly

0818 shipped folio-ig-menu/v1 with a source block that REQUIRES a commit, an ingest taking --source, exit 2 with no source, and a gates exemption because CI cannot obtain the input. Same shape here: the values are read from a template checkout and committed with provenance, never typed.

Declared at SMART-BASE, inherited, so smart-l1 / smart-dak / smart-ig do not each re-copy it.

## Sources, pinned

- WorldHealthOrganization/smart-trust 26635f7b05b647bb4f15a526bac79d23cff57056
- WorldHealthOrganization/smart-ig-template 82603d0795379c829c12c0e9cb15f022afa5c29e (who.template.root 0.5.0)
- HL7/ig-template-base 849a8f5298f521a0af0a48256d4a0c5a83297664 (fhir.base.template 1.0.0)

## Done when

- [x] a schema for the ingested chrome, whose source block requires a commit per layer
- [x] an ingest reading the CSS custom properties out of a template checkout; no --source exits 2
- [x] the three-layer overlay computed, with TYPE CONFLICTS recorded rather than resolved
- [x] declared at smart-base, reachable by smart-trust
- [x] the smart-trust pages carry the blue bar, the DRAFT watermark and the publish box
- [x] a --check gate, with the same CI exemption 0818 documented
- [x] gates green — 135 of 136, the one failure pre-existing on main

## Not verifiable here

litlfred.github.io is 403 policy-denied by this environment's egress proxy, so the published result cannot be confirmed from this session. Local generation, the gate and a rendered preview are the evidence.


## ROUND 1 RESULT, 2026-09-23 — 35 tokens over 2 layers, and TWO upstream defects found

`bun run cat ingest:ig-chrome` against the three checkouts:

    fhir.base.template 1.0.0 @ 849a8f52   won 17
    who.template.root  0.5.0 @ 82603d07   won 18
    rules: #ig-status.ig-status-draft, #ig-status.ig-status-retired,
           #ig-status p            <- who.template.root
           #publish-box            <- fhir.base.template

**THE ATTRIBUTION IS NOW STRUCTURAL RATHER THAN ASSERTED.** This bean opened
claiming the yellow box is HL7's; the ingest proves it, because
`--publish-box-bg-color` comes out with `from: "fhir.base.template"` and
`overrides: []` — nobody at WHO ever touched it. That is exactly what the
required-and-possibly-empty `overrides` field is for, and why a lower layer
declaring an IDENTICAL value is deliberately not recorded as an override:
without that rule, `[]` would stop meaning "one layer decided this".

### A SECOND defect kind, found by this ingest's own author

`--breadcrumb-text-color: ##555555` at `project.css:82` — a doubled `#` in
HL7's source. It appears in our generated page as `##555555`, looking exactly
like a bug in the ingest that copied it, and **it cost me about thirty seconds
of believing I had written it, with the source open in the next terminal.** A
reader without the source open has no way to tell at all.

So `kind` widened from `z.literal("shape")` to `z.enum(["shape", "malformed"])`
and `sites` relaxed from `min(2)` to `min(1)` — a shape conflict needs two
layers by definition, a malformed value needs one, and `min(2)` had made the
second kind unrepresentable in the schema written to hold it. The value is
still mirrored verbatim: a mirror that silently fixes its subject is not a
mirror.

The detector is NARROW on purpose — one pattern, a doubled `#` before a hex.
A false positive here accuses somebody else's published stylesheet of a fault
it does not have.

## A test's PROXY was retired rather than its number raised

`pages-markdown.test.ts` asserted the style block was `<= 12` lines. That was a
proxy for *nobody has quietly reintroduced a theme*, and this change adds one
**on purpose**, taking the block to 77.

Raising the bound to 80 would have kept the test green while retiring the thing
it was for — a future hand-written theme fits under 80 just as comfortably. So
the proxy is replaced by what it stood for: the AUTHORED half is still
`<= 12` lines, and a new test asserts **no page emits a bare `:root`**, which is
the rule that makes mirroring a third party's palette safe at all.

## A LAYERING GAP, recorded rather than worked around

The chrome lives at smart-base so the other SMART IGs inherit one answer. The
obvious consumer-side implementation is to walk `needs` upward — and it does
not work: `smart-trust` needs `smart-ig`, `smart-base` needs `fhir-harness`, so
**there is no `needs` path from smart-trust to smart-base.** Measured from the
two declarations, not assumed.

`chromeFileFor` therefore NAMES the owning instance and resolves its directory
through the declaration. Widening the walk until something matched would have
settled a layering question inside a stylesheet loader. The question is
`nsbb`'s and it stays open and visible.

## What is NOT done

- **Nothing compares the result to the published WHO IG.** `smart.who.int` and
  the gh-pages mirror both answer 403 CONNECT here, so a visual diff cannot
  run. Right by construction (three named commits, verbatim) rather than by
  comparison — stated, not assumed away.
- The mirrored rule set is four selectors, listed explicitly in `MIRRORED`.
  A regex over selectors would quietly widen the mirror every time upstream
  added a rule that matched it.


---

## Re-verification ATTEMPTED and it did not pass — left open, 2026-09-25

Found by `bun run cat beans:landed` as `done-ticked` alongside `0ytk` and `vxho`.
Both of those closed on re-run evidence. **This one did not, and that is the
point of the obligation being re-measurement rather than trust**
(`bean-coordination.md`: *"Two of seven candidates in that sweep failed
re-verification"*).

Not mid-flight — no `Claimed by` note, no open PR, last commit on `main`
touching it is its own merge (`6b99bd65`).

**What was run, 2026-09-25:**

```sh
bun run cat ingest:ig-chrome:check     # exit 2
```

```
could not determine: no --ig and --layer checkouts, so there is nothing to
read the chrome from.
  The committed chrome was NOT verified.
```

**Exit 2 is the gate working, not the gate failing.** It is the `0818` CI
exemption this bean's own sixth box required it to document, firing exactly as
designed: without the IG checkout and its `fhir.template` chain there is
nothing to compare the committed chrome against, and the gate says so instead
of reporting clean. Refusing to close on it is the same discipline.

So three boxes are verifiable from here (a schema exists; an ingest exists and
exits 2 with no `--source`; a `--check` gate exists and documents the
exemption) and **three are not**: the three-layer overlay with its recorded
type conflicts, that the smart-trust pages carry the blue bar / DRAFT watermark
/ publish box, and the "135 of 136" gate count — which is a snapshot, and
`bun run cat gates` counts differently today.

### What would discharge it

Any ONE of these, by whoever has the checkouts:

- run `bun run cat ingest:ig-chrome:check --ig <checkout> --layer <base> --layer <…>`
  and record a **non-2** exit here; or
- point at a CI run that did, on a named sha; or
- re-derive from the published smart-trust pages that the three chrome elements
  are present.

**Expiry: 2026-10-25.** If nothing has discharged it by then, it is not waiting
on a measurement any more — it is abandoned, and should be re-scoped or
scrapped with its reasons rather than left reading as in-flight. Same
requirement `bean-blocking.md` puts on a block, and for the same reason: an
exception carrying no way to re-derive it cannot be told from an oversight.

**Status deliberately unchanged.** Nothing here reopens, re-scopes or reverts
anything; it records one failed re-verification and what would settle it.

---

## Evidence

_2026-09-26, a second session reaching the same refusal — tagged
`ready-to-close` so it is visible to `check:ready-to-close`._

The session above refused this bean for the right reason and left it
`in-progress` without the tag. `bean-coordination` §"When you cannot re-derive
it yourself" is explicit that the un-taggable version of this state is the one
that accumulates: four beans read as finished in their own bodies and sat
`in-progress`, *"every session that met one discharged it the same way — by
leaving it open"*. The tag is what puts it on `bun run cat check:ready-to-close`, so
the owner confirms a batch in one read instead of meeting it again on the next
sweep.

**What I independently re-derived**, on a tree identical to `origin/main`, clean
and with no untracked pollution:

| box | how |
|---|---|
| a schema for the ingested chrome | `cat-harness/schemas/ig-chrome.ts` present |
| an ingest; `no --source exits 2` | `cat-harness/scripts/ingest-ig-chrome.ts` present |
| a `--check` gate exists and runs | `ingest:ig-chrome:check` |
| declared at smart-base | carried in `graph-kind-registry.ts` |
| tests | `ig-chrome.test.ts` + `ingest-ig-chrome.test.ts` → **28 pass, 0 fail** |

**What neither session can re-derive, in one line:** that the smart-trust pages
actually carry the blue bar, the DRAFT watermark and the publish box. The gate
reports the third state — *"could not determine … The committed chrome was NOT
verified"* — and **exits 0 while saying so**, which a caller reading only the
exit code records as a pass. It needs the IG and each `fhir.template` cloned and
passed base-first with `--layer`.

One thing I did NOT take on trust, and the reason is recent: the last box reads
*"gates green — 135 of 136, the one failure pre-existing on main"*. I published
exactly that shape of claim wrongly on 2026-09-25, from a working directory
holding an untracked root `scripts/` that `git status` could not see — bean
`pomp`'s shape, third recorded occurrence. A "pre-existing on main" claim is
only as good as the cleanliness of the tree it was measured in.

## Closed 2026-09-26 on the owner's confirmation

The owner confirmed the close in session
`session_01SFCwxF2nePwDpnQrX66fZE`, answering the one item
`bun run cat check:ready-to-close` was reporting.

`ready-to-close` tag removed with the close: the tag's whole job is to make an
un-re-derivable bean visible to that check, and a tag that outlives the
confirmation would keep a settled bean on the owner's next batch.

**What stays unverified, and is deliberately not claimed by this close.** The
gate reports *"could not determine … the committed chrome was NOT verified"* and
**exits 0 while saying so**. So a caller reading only the exit code records a
pass over a question nobody answered — that no session could confirm the
published pages actually carry the blue bar, watermark and publish box. That is
`ci-health`'s first rule pointed at this bean: could-not-determine is never
green. It is why the close needed a person, and it is the reason the parent
`yj32` still has work.
