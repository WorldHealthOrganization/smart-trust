# AGENTS.md — who-iris

What binds everywhere is the harness's
[`AGENTS.md`](https://github.com/litlfred/cat-harness/blob/HEAD/AGENTS.md); what
this layer *is* is [`README.md`](README.md). The rules here turn on the
difference between knowing of something and holding it.

## The gap is the point, not a shortfall

The catalogue models a small fraction of what upstream reports: **273,559
items** across **1,057,223 files**. **A catalogue by reference models the SHAPE
of a corpus without holding it.** So the gap is never a finding, a backlog, or
a reason to bulk-import.

**No node count is written here on purpose:** a count in prose goes stale, and
`bun run check:catalogue` prints the census. The two upstream figures are exact
— transcribed from IRIS's own pages and recorded with their basis in
`catalogue/catalogue.json`.

Before materialising anything, go through the gates in
[`materialize-remote`](../folio-assistant-core/schemas/materialization.ts).
Holding a thing has a cost that referencing it does not.

## Every node declares its state, and there is no default

`referenced`, `materialized`, `unknown` — a node that has not said is
**invalid**, and the check enforces it:

```sh
bun run check:catalogue
```

**"The author did not say" and "the author said they could not tell" are
different facts.** A default would collapse them, and `unknown` would then mean
either "nobody looked" or "somebody looked and could not determine", with no
way to tell which.

## Is it actually an IRIS item?

A handle, a DSpace UUID, a collection path — something in the catalogue that
names it. If a document has none of these it is **not** an IRIS item, whatever
its subject, and it does not belong here: the next agent looking for the WHO
corpus would find something they cannot explain.

## The style guide is derived from the library, and lives beside it

The WHO house voices (`skills/voices/`) and the WHO glossary (`glossary/`) are
the **style guide**: KG content derived from the publications in `library/`.
A voice is derived from a publication and never copies it; the rules for
working on one are in [`docs/style-guide-agents.md`](docs/style-guide-agents.md),
and what the style guide is, in [`docs/style-guide.md`](docs/style-guide.md).

## Translations: round-trip rulings are keyed by content

The round-trip rulings of the site and glossary catalogues live on
`cat/who-iris/attestations`, each pinned by the hashes of the msgid and
msgstr it judged; `scripts/translation-roundtrip-report.ts` pairs them with
strings by those hashes, not by position. A PR that removes or reorders
strings needs no agent re-run. Once it is on main, run
`bun run cat translation-qa:prune` (a dry run), then `--write` and
`bun run cat state:push` if the diff is only dropped and renumbered rulings.
Never prune from the removing branch before it merges: main would be left
with strings that have no ruling.

---

*A declared asset of this instance ([`who-iris.json`](who-iris.json), role
`agent-instructions`).*

## The skills this layer publishes

<!-- skills:index:begin -->

_5 skills in 1 directory, generated from each skill's front matter. `bun run cat readme:sync` rewrites this list and `readme:sync:check` fails when it is stale. Skills this repository inherits are listed by the repositories that publish them._

**`skills/`** (5)

| Skill | What it is for |
|---|---|
| [`iris-cdn-exporter`](skills/iris-cdn-exporter.md) | The IRIS CDN Exporter agent — how WHO IRIS is exported onto Cloudflare — a git repository on Cloudflare Artifacts and R2 behind the CDN — with an initial load (metadata and PDFs), a nightly change… |
| [`iris-cdn-signing`](skills/iris-cdn-signing.md) | How an IRIS CDN release is packaged, signed and verified using published standards only: a BagIt bag (RFC 8493), a detached JWS (RFC 7515 App. |
| [`iris-dspace`](skills/iris-dspace.md) | How WHO IRIS uses DSpace and qualified Dublin Core — the three identifier systems, MeSH as a controlled vocabulary, bundles, and the containment path — and the requirements a tool reading a record… |
| [`iris-oxigraph`](skills/iris-oxigraph.md) | How to build WHO IRIS catalogue and Qualified Dublin Core metadata into partitioned N-Quads, and query it with Oxigraph — in Bun on the build side, in WebAssembly in the browser — including… |
| [`iris-rest-feed`](skills/iris-rest-feed.md) | How to read changes from the WHO IRIS DSpace 7 REST API: the nightly "changed since" walk over Discovery, the weekly reconciliation that stands in for the deletions REST does not report, and the… |

<!-- skills:index:end -->
