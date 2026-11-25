---
name: iris-cdn-exporter
description: >
  The IRIS CDN Exporter agent — how WHO IRIS is exported onto Cloudflare — a git
  repository on Cloudflare Artifacts and R2 behind the CDN — with an initial load (metadata and PDFs), a nightly
  change ingest over the DSpace REST API, a weekly reconciliation, and one
  signed release per run. What the agent decides, what the pipeline does, and
  the no-churn rule both obey.
graph-typologies:
  - catalogue
---

# The IRIS CDN Exporter

The exporter is an **agent role** plus a set of deterministic scripts. The
scripts (`scripts/iris-cdn/`) move bytes. The agent plans, reviews and
reports. It never holds the signing key and never pushes to a WHO
repository.

Processes, all in `processes/`:

| Process | When | What |
|---|---|---|
| `iris-cdn-initial-load.bpmn` | once, run by hand with a stated budget | every record and every bitstream, in resumable batches |
| `iris-cdn-nightly.bpmn` | every night, 02:00 UTC | only the items IRIS reports as changed |
| `iris-cdn-reconcile.bpmn` | Sundays, 04:00 UTC | catches withdrawals, which REST does not report, and checks for drift |
| `iris-cdn-sign-publish.bpmn` | called by the three above | BagIt bag, detached JWS (ES256), did:web key, verify |

What each process does is in
[`docs/iris-cdn-export.md`](../docs/iris-cdn-export.md); where it runs, what
it writes where, and its secrets are in
[`docs/iris-cdn-deployment.md`](../docs/iris-cdn-deployment.md); signing is
skill `iris-cdn-signing`; reading changes from IRIS is skill `iris-rest-feed`.

## The no-churn rule

Content that has not changed is not rewritten, re-uploaded or re-signed. Each
step says how:

1. **Canonical records.** A record is written as JSON with sorted keys, LF line
   endings and no fetch timestamp inside it. If the canonical bytes equal the
   held ones, the file is not rewritten.
2. **Content-addressed bitstreams.** A bitstream is stored under its SHA-256.
   An object that already exists is never downloaded, uploaded or overwritten
   again.
3. **Sorted graph output.** The graph is rebuilt in full, and N-Quads
   partitions are written sorted, so a partition with no changed item comes out
   byte-identical and is not re-uploaded.
4. **Date-free manifests.** `bag-info.txt` has no `Bagging-Date`, so the tag
   manifest of an unchanged payload is byte-identical.
5. **An empty diff ends the run.** No commit, no new signature.

A step that cannot meet its rule reports it. It never hides it.

## What the agent does

- **Plan** the initial load as one batch per collection page, with the
  checkpoint in `state/initial-load.json` in the Cloudflare git repository.
- **Review** each run report and open a bean for each anomaly: a change count
  far from the recent median, a quarantined bitstream, a verification whose
  verdict is `unknown`, or a partition over its size ceiling.
- **Never widen scope.** Only the owner changes what is exported, its budget
  or where it is stored.

## What the agent must not do

- Push to any `WHO/*` repository.
- Treat a short listing as a mass withdrawal (see `iris-rest-feed`).
- Delete a published object. A withdrawn item is *marked* withdrawn, and its
  bytes stay addressable because a citation to them may exist.
- Put an upstream count into prose. Counts come from the catalogue and the
  run reports.
