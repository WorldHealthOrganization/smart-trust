# IRIS CDN Exporter: deployment

Where the [IRIS CDN Exporter processes](iris-cdn-export.md) run, where they
write, and where the secrets live.

The short version: **GitHub Actions runs the exporter. Cloudflare holds and
serves everything it exports. GitHub Pages only previews.**

## The pieces

| Piece | Service | Holds |
|---|---|---|
| Runner | GitHub Actions in `litlfred/who-iris` (`.github/workflows/iris-cdn.yml`) | nothing between runs; each run's report goes to the workflow log |
| Release history | git repository on **Cloudflare Artifacts** | BagIt tag files, `tagmanifest-sha256.txt.jws`, and `state/*.json` (cursor, initial-load checkpoint, sizes, md5, uuids, metadata hashes, withdrawals) |
| Bytes | **Cloudflare R2** bucket | PDFs, item records, item manifests and their JWSs, graph partitions (`.nq.gz`), each under `sha256/<aa>/<digest>` |
| CDN | Cloudflare, in front of R2 on a custom domain | cached copies only, with an immutable cache policy |
| DID document | served from the CDN domain | `did.json` with the public key(s), a `did:web` document |
| Signing key | GitHub **environment secret** | the P-256 private JWK |
| Previews | GitHub Pages of `litlfred/who-iris` and `WHO/who-iris` | the site, reading exported data from the CDN; three materialized items for testing |

## Cloudflare: what to set up

1. **Workers Paid plan**, $5 a month. Artifacts needs it, and it is in open
   beta. ([changelog](https://developers.cloudflare.com/artifacts/platform/changelog/))
2. **Artifacts namespace and repository.** Create the namespace in the
   dashboard. Then create the repository:
   `npx wrangler artifacts repos create who-iris-releases --namespace <ns>`.
   The remote is
   `https://<ACCOUNT_ID>.artifacts.cloudflare.net/git/<ns>/who-iris-releases.git`.
   A repository created now is capped at **1 GB**
   ([limits](https://developers.cloudflare.com/artifacts/platform/limits/)). That
   is why git holds only the release history, and the bytes go to R2.
3. **R2 bucket**, for example `who-iris-cdn`. Storage is about $0.015 per
   GB-month and egress is free, so ~361 GiB costs about $5.40 a month.
4. **Custom domain** on the bucket, which puts the Cloudflare CDN in front of
   it. Then add a **Cache Rule** with `Cache-Control: public,
   max-age=31536000, immutable` for `sha256/*`. Content-addressed objects
   never change, so they can be cached forever.
5. **API token** with permissions for Artifacts (edit) and the R2 bucket
   (object read and write). Scope it to this one account.

## GitHub: where each secret goes

In `litlfred/who-iris`, go to **Settings → Environments → New environment**
and name it `iris-cdn-release`.

- **Deployment branches:** `main` only. A job on any other branch cannot read
  these secrets.
- **Required reviewers:** none, so the scheduled runs stay unattended.

| Name | Kind | Where | What |
|---|---|---|---|
| `IRIS_CDN_SIGNING_JWK` | secret | environment `iris-cdn-release` | the P-256 private JWK: `{"kty":"EC","crv":"P-256","x":…,"y":…,"d":…}` |
| `CLOUDFLARE_API_TOKEN` | secret | environment `iris-cdn-release` | the API token from step 5 |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | secret | environment `iris-cdn-release` | R2's S3-compatible credentials, for uploads |
| `IRIS_CDN_TRUST_ANCHOR_JWK` | variable | repository | WHO's signing-DID public key (JWK), so verification checks the `x5c` chain. Verification refuses to run without it |
| `IRIS_CDN_DID` | variable | repository | the DID that publishes the signing key, e.g. `did:web:<cdn-domain>` |
| `IRIS_CDN_KEY_ID` | variable | repository | the key's fragment in that DID document (default `release-1`) |
| `CLOUDFLARE_ACCOUNT_ID` | variable | repository | not secret |
| `IRIS_CDN_ARTIFACTS_NAMESPACE`, `IRIS_CDN_ARTIFACTS_REPO` | variable | repository | the Artifacts namespace and repository from step 2 |
| `IRIS_CDN_R2_BUCKET` | variable | repository | the bucket from step 3 |
| `IRIS_CDN_ENABLED` | variable | repository | `true` turns the workflow on (on `main` only); anything else leaves it off |

The workflow never stores the Artifacts git token. Each run mints a write
token that lasts an hour
(`wrangler artifacts repos issue-token … --ttl 3600`) and passes it to git
as a `Bearer` header. It never goes in the remote URL.

How the signing key was created and published is outside this deployment; see
[key custody](../skills/iris-cdn-signing.md#key-custody-and-rotation).

## What runs when

| Workflow trigger | Process | Environment |
|---|---|---|
| `schedule: 0 2 * * *` | nightly change ingest | `iris-cdn-release` |
| `schedule: 0 4 * * 0` | weekly reconciliation (Sunday) | `iris-cdn-release` |
| `workflow_dispatch` with `mode: nightly` or `reconcile` | the same, on demand | `iris-cdn-release` |

Runs never overlap (one concurrency group), and a job times out after 350
minutes. Each run clones the release history, runs
`bun scripts/iris-cdn/run.ts <mode> --release release`, commits and pushes
only if something changed, then verifies the published release.

The initial load is **not** a workflow mode. It is run by hand:
`bun scripts/iris-cdn/run.ts initial-load --release <checkout> --budget <json-or-file>`.
The budget's `maxBatchesPerRun` bounds one run, and the next run resumes from
the checkpoint in `state/initial-load.json`; the caller commits and pushes the
checkout after each run.

## Previews on GitHub Pages

The who-iris site on GitHub Pages renders pages from data it reads **from the
CDN**. It never copies the export into the Pages artifact. The three items
materialized today stay in this repository as test fixtures. That keeps Pages
small, and a preview always shows what the CDN actually serves.

## Still open

- **The domain.** The DID is tied to the domain, so this has to be settled
  before the first signed release. The recommendation is a domain the owner
  adds to Cloudflare.
