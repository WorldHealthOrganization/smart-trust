---
name: copy-out-materialized
description: >
  Materialized content is read-only. To work on it you take a copy into your
  own folio/, and the copy records what it is a copy of — the local-provenance
  edge, which is not the upstream one.
---

# Working on materialized content — copy it out

**Materialized content is a copy of somebody else's bytes, and this repository
does not edit it in place.** The contents of a materialized
`<stub>/<sub-graph>` are immutable, and the rule is enforced: to work on them,
copy them into your own `folio/`.

Diagram: [`copy-out-materialized.bpmn`](../../processes/copy-out-materialized.bpmn).
Schema: the `folio-materialization/v1` record (`MaterializationSchema`, owned
by the content layer above this one — named here, not linked). Where they disagree,
the schema wins and this file is wrong.

## What the rule protects, and what it does not

It protects the CLAIM. A materialized record asserts *"these bytes are what
upstream published"*. Editing them in place leaves that assertion standing over
bytes it no longer describes — and `check:materialized-fixity` is what catches
one that happened, by hashing the bytes against the digest the record carries.

It does **not** protect against the copy being wrong, stale or badly chosen.
Those are the five gates' job, at materialisation time
([`materialize-remote`](materialize-remote.md)), and a copy-out re-opens none
of them: you are copying something this repository already decided it may hold.

## Who may copy out

**Any reader.** This is deliberately not a permission: refusing a copy would not protect the original, because the
original is protected by being read-only. A gate here would only stop people
working.

What copying out does NOT confer is the right to publish. The copy inherits its
source's `restrictions` and `copyright` verdicts, and it is a new artefact in
**your** folio whose publication is your folio's decision, judged the way any
other authored content is.

## Where the copy goes

**Into the copier's own `folio/`, with provenance** — never a scratch area,
which makes the copy publishable by accident: a directory nobody declared is a
directory nobody gates.

## The copy records what it is a copy of

This is the part that is easy to leave out and impossible to reconstruct later.

`materialization.provenance` is a **pair**:

| field | points at |
|---|---|
| `upstream` | the remote thing — a URI, upstream |
| `local` | the original **in this repository** it was taken from |

A copy-out writes **`local`**. It does not overwrite `upstream`, and it does not
reuse `upstream` for the local original.

Without `local`, one rename later a copy is indistinguishable from original
work. That is the whole failure this step exists to prevent, and nothing
downstream can repair it: the information was never written down.

## The copy is NOT read-only

A materialized node is frozen because it is a claim about somebody else's
bytes. A copy in your own `folio/` is **yours**, makes no such claim, and is
ordinary authored content — so it is writable, and its directory's `readOnly`
is `false`.

If it were frozen too, the copy-out would achieve nothing, and the next person
would need a copy of the copy.

## The exception is "say what you did", not a list of who may skip

The exception — for publication workflow purposes and the like — is a rule,
not an allowlist of writers that would go stale:

> **A step that rewrites a materialized artefact records the new fixity in the
> same change.**

Then `check:materialized-fixity` passes and the record describes what is
actually there. A step that rewrites without updating fixity fails, correctly,
because it has forked upstream without saying so — which is exactly what the
rule exists to prevent. The check asks a question about BYTES and never about
who wrote them, so it needs no attribution of a commit to a process step.

### Where it applies

**`refresh-materialized.bpmn`'s `Task_Apply`** is the one step in the declared
corpus that rewrites bytes a materialization record describes, so it writes
the new fixity in the same change; otherwise a correct run of it would fail
the gate as an unannounced edit.

**No publication process writes to materialized content.**
`kg-to-portal.bpmn`'s `S_Sign` signs a subgraph cut from the KG — derived
content, not held upstream bytes. So the publication case is a rule with no
instance yet, stated here rather than drawn as a step no diagram does, because
a declared-but-absent step makes a consumer report a clean run over nothing.

## What to check afterwards

- `bun run cat check:materialized-fixity` — the original still hashes to its
  recorded digest. If it does not, the copy-out was an edit in place.
- `bun run cat check:read-only-graphs` — your folio's directory is not accidentally
  declared read-only, and the source's still is.
