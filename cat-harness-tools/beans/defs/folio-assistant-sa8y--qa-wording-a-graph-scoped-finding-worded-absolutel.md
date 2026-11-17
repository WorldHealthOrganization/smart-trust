---
# folio-assistant-sa8y
$schema: bean/1.0.0
title: 'QA WORDING: a graph-scoped finding worded absolutely sent a session to a wrong fix'
status: completed
type: task
priority: high
created_at: 2026-09-20T05:52:43Z
updated_at: 2026-09-26T00:00:00Z
parent: folio-assistant-d308
---

A finding scoped to one graph but **worded absolutely** sent this session to a
wrong fix, and the wrong fix was caught only by a test written the day before.

## What the report says, and what is true

`kg:audit` at the repo root reports:

> skill "confirm-harness" is listed by no package manifest, carried by no role
> and named by no activity.

Each clause is true **of the root instance's graph**. None is true absolutely:
`bootstrap/workflows/initialize-harness.bpmn` names `confirm-harness` **three
times**, and `bootstrap/harness.json` declares the directory holding it.

## Why that matters more than wording usually does

Reading it as absolute, I concluded the audit had a blind spot, traced it to
`workflowDirs` probing `<declared>/workflows` (so the `bootstrap` entry pointing
at `bootstrap/skills/` probes `bootstrap/processes/`, a sibling of the real
directory), and **declared `bootstrap/workflows/` at the root to fix it.**

`scripts/tests/instance-graph-isolation.test.ts` failed immediately, and it was
right: one instance's graph must not carry another's nodes. That was a LIVE defect
on `main` on 2026-09-19 — `findBpmnDirs` walked the filesystem, and
`_kg/folio-assistant.jsonld` carried **88** references to
`Process_InitializeHarness`. My change re-introduced it exactly.

Reverted in full. The isolation is deliberate and correct; the audit's scoping is
correct; **only the sentence is wrong**, and it cost a wrong change that a test
had to stop.

## The fix

Every finding that ranges over a graph should name the graph it ranged over:

> …named by no activity **in this instance's graph** (`cat-harness` at `skills/`).
> A nested instance may name it; this audit does not read one.

Cheap, and it removes the reading that produced the error. The same applies to
every criterion phrased as an absolute absence — `skill-in-role-or-process`,
`remote-skill-is-servable`, `skill-servable`.

## The second finding, which the detour did establish

**Bootstrap's process is auditable in principle and unaudited in practice.**
`collectInstanceNodes(BOOT, …)` works — the isolation test asserts bootstrap's own
graph DOES carry its process — but nothing ever runs the audits with `bootstrap/`
as root. So `kg:audit`, `translate-bpmn`, `render:bpmn` and `check:workflow-refs`
all skip it, and the **first process a new instance runs** has no sidecar, no
`.pot` and no rendered SVG.

Measured while the root declaration was briefly in place, so these are real
regardless of who should be reporting them:

- `skill-servable` ×3 — `confirm-harness` exists but no local package serves it,
  so `skill_fetch` answers "package not found". `bootstrap/skills/` has no
  package manifest.
- `lane-binds-role` ×3 — lanes `Initiator`, `Requestor` and
  `Knowledge Graph Data Store` match no declared role.
- **`render:bpmn` fails outright**: `no diagram to display`. The file carries no
  `<bpmndi:BPMNDiagram>`, so no BPMN tool can draw it. It executes and cannot be
  seen.

The remedy is to run each gate per declared instance rather than once at the root
— which is the same "nested declarations are not reachable from the root" gap the
`bootstrap` entry's own description already names.

## Third: a stale sidecar is residue of that fixed defect

`test/results/kg-qa/bootstrap/workflows/bootstrap.kg-qa.json` audits
`bootstrap.bpmn`, which `main` replaced with `initialize-harness.bpmn`. It was
written by the pre-fix run that walked the filesystem — which is *why* it exists —
and `kg:audit:check` does not flag it, because nothing at the root walks that
directory to notice the subject is gone.

**Not deleted.** One file, ~1 KB, subject removed on `main` 2026-09-19.
`deletion-requires-confirmation`: reported, waiting.

## Done when — THE AUTHORITATIVE LIST

*Promoted to the top 2026-09-26 under bean `sfhr`, which catalogued this exact
class. This bean carried **three** "done when" lists and the one a reader reached
LAST was the stalest: its four "genuinely open" items were three-quarters already
closed by the list above it. The lists below are kept for their reasoning and
each now points here. Where any of them disagrees with this list, this list is
right.*

- [x] **graph-ranging findings name their graph** — the bean's actual subject.
      `graphScope()` appends the scope, built from the DECLARED path strings, and
      carries the 2026-09-20 incident in its own doc comment
- [x] **`bootstrap/skills/` is servable** — the manifest exists and lists
      `confirm-harness`; and the manifest was never the blocker, `manifestSkills()`
      hardcoding `join(root, "skills")` was
- [x] **the three lanes bind roles** — done on the LANE, which is why it cost no
      dangling link. Re-measured 2026-09-26, below
- [x] **`initialize-harness.bpmn` has a `BPMNDiagram`** — 2026-09-20; still there,
      re-measured below
- [x] **the stale `bootstrap.bpmn` sidecar** — owner decided "Delete it"; gone in
      `30f5057`, reported before acting (2409 bytes, last touched 2026-09-19)
- [x] **the root's silence about a nested instance is reported** — criterion
      `nested-instance-audited` (`minor`)
- [→] **a gate runs the audits per declared instance** — NOT done, and moved to
      bean `bjzs` rather than left here. A different subject: this bean is about a
      finding's **wording**, that one is about a gate's **range**

## Superseded list 1 of 3 — kept for reasoning; see the authoritative list above

- [x] graph-ranging findings name their graph — `skill-has-entry-point` and
      `skill-in-role-or-process` now append the scope, built from the DECLARED
      path strings rather than computed relative ones (computing them printed
      `../bootstrap/skills` once the tree moved into `cat-harness/`, which is
      accurate and reads like a bug)
- [→] a gate runs the audits per declared instance, or the root's silence about a
      nested one is itself reported — moved to bean `bjzs`; see THE AUTHORITATIVE LIST
- [x] `bootstrap/skills/` gets a package manifest so `confirm-harness` is servable — the manifest exists (measured 2026-09-26)
- [x] the three unbound lanes get roles, or the lanes are renamed to declared ones — bound on the LANE by `#1168`; measured 2026-09-26
- [x] `initialize-harness.bpmn` gets a `BPMNDiagram`, or its absence is a recorded
      criterion rather than a hard renderer failure — added 2026-09-20; 2 occurrences today
- [x] the stale sidecar: **owner decided — "Delete it"**, and it is gone. Done in
      `30f5057`, reported before acting: 2409 bytes, last touched 2026-09-19,
      subject `bootstrap.bpmn` removed on `main` 2026-09-19

---

## Done 2026-09-20: the two graph-ranging findings now name their scope

> skill "confirm-harness" is listed by no package manifest, carried by no role and
> named by no activity. **In this instance's graph only** (read: `cat-harness` at
> `skills/`, `bootstrap` at `bootstrap/skills/`, `cat-harness-src` at
> `src/skills/`) — a nested instance may name it, and this audit does not read
> one.

The reading that produced the wrong change is now unavailable: the sentence says
what it ranged over and says a nested instance is out of range.

`graphScope()` carries the 2026-09-20 incident in its own doc comment — the
absolute wording, the wrong fix, and the test that stopped it — so the next author
meets the reason where they meet the code.

### One thing the fix surfaced on the way

Computing the paths relative to the audit's root printed
`` `bootstrap` at `../bootstrap/skills` ``, because the script now runs from
`cat-harness/` and `bootstrap/` is its sibling. Accurate, and it reads like a
defect. Switched to the declared `path` string: it is what a reader would go and
edit, and it cannot acquire a `../` when the tree moves again. "Resolve, do not
compose", applied to a diagnostic rather than to a link.

### Superseded list 2 of 3 — kept for reasoning; see the authoritative list above

- [x] the root's silence about a nested one is now **reported**, as criterion
      `nested-instance-audited` (`minor`). It names the instance, counts the
      diagrams this run did not read, states that the silence is CORRECT, and
      warns against the exact wrong fix — declaring its directories at the root,
      which re-introduces the leak `instance-graph-isolation.test.ts` guards.
      A reported number is not deducible-and-mis-deducible
- [→] running the audits per declared instance is still open, and is the half that
      would actually AUDIT bootstrap rather than count it. The criterion makes the
      gap visible; it does not close it — moved to bean `bjzs`
- [x] `bootstrap/skills/` package manifest — **and the manifest was not the
      blocker.** `manifestSkills()` hardcoded `join(root, "skills")` and scanned
      only one level of subdirectories, so a manifest AT a declared directory was
      invisible however correctly written. `gen-skill-docs` already documents that
      `bootstrap` and `cat-harness-src` hold their skills DIRECTLY. Both that
      function and `manifestEntries()` now derive from `kgDirectories` and accept
      either shape, through one shared walk so they cannot drift apart again.
      `skill-has-entry-point` went 1 → 0
- [~] the three unbound lanes — **NOT work, a recorded decision.** The four
      roles exist in `bootstrap/scenarios/roles.json` with the right flags
      (`knowledge-graph-data-store` and `logger` `actedUpon`, `requestor`
      `judgementOnly`); what is missing is `lanes` on each, and that absence is
      **deliberate**. The file's own `_lanes_comment` records why: the root
      declares `bootstrap/skills/` but NOT `bootstrap/workflows/`, so a `lanes`
      entry mints `bindsLane -> role/Initiator` in folio-assistant's graph
      pointing at a lane node only bootstrap's export produces — **three
      dangling links, measured 2026-09-20**. Whether the root should declare
      both halves or neither is bean `pve3`.

      **Binding them would have re-created the shape of the wrong fix that
      started this bean** — one instance's graph carrying another's nodes.
      Left alone, deliberately.
- [x] that diagram has no `BPMNDiagram` — **added 2026-09-20.** The premise
      about the renderer was also stale: `render:bpmn` exits 0 and never lists
      it, because `workflowFiles(ROOT)` reads cat-harness's declared graph and
      the root does not declare `bootstrap/workflows/`. Same isolation, again.

      Worth doing anyway, and the reason is not this repository's renderer: a
      BPMN file with no DI opens as an **empty canvas in any editor**, so a
      person opening it to read the process saw nothing. 14 shapes, 3 lanes,
      15 edges. Validated by round-tripping through `bpmn-moddle`: 1 diagram,
      33 plane elements, **0 warnings and 0 unresolved `bpmnElement`
      references**. Not rendered to SVG here — `bpmn-js` is one of the
      `--all` browser jobs and is not installed in this container — so that
      half is stated as unverified rather than claimed.
- [x] the stale `bootstrap.bpmn` sidecar — ~~owner's call, still untouched~~
      the owner had ALREADY decided "Delete it" when this line was written; gone
      in `30f5057`, which is the re-check-rather-than-re-ask below


---

## 2026-09-20 — the sidecar item was already closed; four remain

Re-checked rather than re-asked. `find` for `bootstrap*.kg-qa.json` returns
**nothing**, and `git log --diff-filter=D` names the commit that removed it:
`30f5057`, *"options-analysis.bpmn, and the two deletions the owner authorised"*.
Its message records the figures that were reported **before** acting — 2409 bytes,
last touched 2026-09-19, subject gone — which is what
`deletion-requires-confirmation` asks for.

So this bean was carrying an open question the owner had already answered. Ticked
rather than re-raised: asking twice is its own failure, and it spends the one thing
the owner's accessibility constraints make expensive.

### Superseded list 3 of 3 — "the four that are genuinely open" was wrong when written and is wronger now; see the authoritative list above

- a gate runs the audits **per declared instance**, or the root's silence about a
  nested one is itself reported. `kg:audit` currently reports
  `graph:kg nested-instance-audited (2)`, so the finding exists and the **gate**
  does not
- `bootstrap/skills/` gets a package manifest, so `confirm-harness` is servable
- the three unbound lanes get roles, or are renamed to declared ones
- `initialize-harness.bpmn` gets a `BPMNDiagram`, or its absence becomes a recorded
  criterion rather than a hard renderer failure

Each is work, not a judgement for the owner. Left for a session that can take the
nested-instance question whole, because the first item changes what the audit
**ranges over** and the other three are findings inside that range — doing them in
the other order means auditing them twice.

---

## RECONCILED 2026-09-26 — three of the four "genuinely open" items were already done, and the fourth is now `bjzs`

The last list in this bean said four items were open. Re-measured rather than
re-asked, because re-asking is the one thing the owner's accessibility
constraints make expensive:

| the list said | measured 2026-09-26 | evidence |
|---|---|---|
| `bootstrap/skills/` needs a package manifest | **exists** | `bootstrap/skills/package-manifest.json`, 784 bytes, 7 skills, `confirm-harness` among them |
| the three unbound lanes need roles | **bound** | `bootstrap/processes/initialize-harness.bpmn:32,48,53` |
| `initialize-harness.bpmn` needs a `BPMNDiagram` | **present** | 2 occurrences (open + close) |
| a gate runs the audits per declared instance | **still open** | now bean `bjzs` |

### The lane item is the interesting one — it was `[~]` and is now `[x]`, and the mechanism changed underneath it

This bean recorded the lanes as *"NOT work, a recorded decision"*, because
adding `lanes` to each role would mint `bindsLane -> role/Initiator` in
folio-assistant's graph pointing at a lane node only bootstrap's export
produces — **three dangling links**. That reasoning was correct for the
mechanism as it stood.

It no longer stands. `#1168` inverted the relation (bean `nafz` records the
landing): a **lane names its role** with `<…processes:role ref>`, and a role no
longer carries `lanes[]`, on the principle that a general node never names its
users. So the binding moved to the end that could carry it without crossing the
instance boundary:

```xml
<bpmn:lane id="Lane_BootstrappingAgent" name="Bootstrapping Agent">
  <bpmn:extensionElements><bootstrap.processes:role ref="bootstrapping-agent"/></bpmn:extensionElements>
```

All three refs resolve against `bootstrap/scenarios/roles.json`
(`bootstrapping-agent`, `requestor`, `knowledge-graph-data-store`), and all four
declared roles now carry **no** `lanes` key — so there is nothing left to
dangle. `roleForLane` resolves an explicit ref ahead of the name table, which is
why this costs no root-graph edge.

Two corrections to this bean's own record while I am here:

- **The lane names are stale.** This bean lists `Initiator`; the lane is
  `Lane_BootstrappingAgent` / *"Bootstrapping Agent"*. Nothing named `Initiator`
  is in the file.
- **`_lanes_comment` is gone**, and the bean still cites it as the record. It was
  right to go: bean `ug4r` is the whole argument — *"a `_lanes_comment` string
  inside a JSON file, which no tool reads"* — and its remedy was
  `<folio:role variable="true"/>` on the lane, a declaration in a form a tool
  reads. So a citation in this bean now points at a string that no longer
  exists, which is the same defect one level out: **a record is only a record
  while something reads it.**

### And the count this bean quotes is stale, which is the rule earning another instance

> `kg:audit` currently reports `graph:kg nested-instance-audited (2)`

It is **15** as of this run — 15 declared instances, 5 unread diagrams
(`bootstrap` 3, `folio-assistant-core` 1, `smart-base` 1), read from
`test/results/kg-qa/scenarios/kg.kg-qa.json`. The criterion did not change; the
tree grew. `kg:audit`'s own reading rules say **never quote a count from prose**,
and this bean quoted one into prose eleven lines after invoking the discipline
that forbids it. The figures above are in the same position and should be read
from the sidecar too.

### What this bean is closed on

Its subject — *a graph-scoped finding worded absolutely* — is fixed, tested, and
carries its own incident report at the code. Everything the detour surfaced is
either done or has a bean. Closing.
