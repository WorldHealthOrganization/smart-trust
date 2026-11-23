---
name: kg-to-portal
description: >
  Getting a knowledge graph out to a public portal — the six stages between
  "the graph is in the repository" and "a reader's browser has the bytes", why
  a CDN is a layer rather than a publication host, and which decisions are the
  deployment's to make rather than the pipeline's.
---

# KG → package → distribution → portal

A knowledge graph is in a repository. A portal — a Moodle site, a ministry's
intranet, a department page — needs to show what is in it, to readers the
repository never hears about, through a data-ingestion pipeline subject to
operational and deployment constraints (for example, a CDN behind Moodle).
**This is the shape of that path**, written as a pattern so the next layer
does not rebuild it unnamed.

## A CDN is a layer, not a publication host

`PUBLICATION_HOSTS` in `schemas/kg/cat-harness.ts` is `github-pages`,
`local-server`, `jurisdiction-endpoint`, `none`. Every value answers *what
serves the rendering*. A CDN answers a different question: *what stands
between the server and the reader*. jsDelivr in front of raw GitHub,
Cloudflare in front of an origin, an institutional cache in front of a
ministry endpoint — the origin is unchanged in all three.

If the CDN is modelled as the host, the published URL becomes the CDN's URL,
and the day the CDN changes every citation breaks. Model it as a layer: the
canonical URL stays the origin's, with the CDN as an accelerated route to the
same bytes.

**Do not add a CDN value to `PUBLICATION_HOSTS`.**

## The six stages

| # | stage | produces | who decides |
|---|---|---|---|
| 1 | **Select** | the subgraph that leaves | the deployment — see §"What the deployment decides" |
| 2 | **Serialize** | one JSON-LD document | the platform — `kg-export` already does this |
| 3 | **Package** | an addressable set of files with a manifest | the platform |
| 4 | **Sign** | a verifiable attestation over the package | the deployment picks the scheme |
| 5 | **Distribute** | bytes at an origin, optionally behind a cache | the deployment picks the transport |
| 6 | **Verify** | a portal-side check that what arrived is what was sent | the portal |

**Stage 1 is not "export everything".** `kg-export` produces the whole graph
for inspection; a portal wants what its readers may see. Running one as the
other is how a `qa-review` verdict, a work item's blocking note or an unpublished
draft reaches a public cache. Content that must be stripped before
publication is stripped at stage 1, once, rather than at each consumer.

**Stage 6 is the one that gets dropped**, because it produces nothing when it
passes. A package that is signed and never verified has a decorative
signature. If the portal cannot verify, say so — `unknown` is a third state.

## What the deployment decides, and the pipeline must not

Three decisions belong to the deployment. A diagram or a script that picks one
is asserting a decision nobody made.

**1. The ingestion method is UNDETERMINED.** Not "to be confirmed" and not
"defaults to X" — the pipeline is drawn with a decision point there, and it
stays open until a deployment answers it. Candidates (a pull from the portal,
a push to an object store, a git fetch, a signed tarball on a schedule)
differ in every dimension that matters, and the constraints below govern the
choice.

**2. The store must be versioned, and which one is a deployment choice.**
**Versioned is the requirement; hosted git is one satisfaction of it.** A
portal must be able to say *which* graph it shows — "what did this look like
last term" is a question a course reading list asks every year.

**3. The distribution transport.** GitHub Pages is a tool choice — the
`gh-pages` Tool, satisfying the general
[`render-kg-to-cdn`](../../process/workflow/render-kg-to-cdn.md) step — and
so are jsDelivr, Cloudflare, or an object store. Reach host behaviour through
`publication.host`, never by assuming Pages' behaviour: Pages **cannot** serve
`application/ld+json`, and a local server can.

## The constraints the choice is made under

Four, and each needs a **denominator** before it can be argued with:

| constraint | the number it needs | where one comes from |
|---|---|---|
| **money** | cost per GB served, and per GB stored | the host's price list; a free tier is a number too |
| **network traffic** | bytes × requests, per publication period | the package's own size and the portal's reader count |
| **graph size** | nodes and edges, and bytes of the serialization | `kg-export` reports it; the IRIS replica's catalogue reports items, files and bytes separately |
| **latency** | where the readers are against where the origin is | the deployment's own geography |

**A constraint with no denominator is a preference.** "The graph is too big" is
not a finding; "6.2 MB per publication × 400 readers per week against a 100 GB
free tier" is. `materialization`'s `size` gate keeps the same rule.

**Measure, and say when you could not.** `cdn.jsdelivr.net` is egress-blocked
from this repository's own CI container, so no figure about it can be measured
here. A figure taken from a vendor's documentation is a *quoted* figure and
says so; one taken from a chat message is neither.

## Trust: GDHCN, distributed as WHO SMART Trust DID trustlists

Proposal signing uses GDHCN, specified by the
[WHO SMART Trust Implementation Guide](https://smart.who.int/trust)
(`smart.who.int.trust`, FHIR R5, support address `gdhcn-support@who.int`).
Everything in this section is read off that IG (`sushi-config.yaml` and
`input/pagecontent/concepts_did_gdhcn.md`). The endpoints below are
**transcribed, not fetched** — `tng-cdn.who.int` is unreachable from this
container.

**GDHCN supplies key distribution, not the signing envelope.** A GDHCN
trustlist carries *trust anchors* — which keys belong to which participant,
for which domain and which usage — and says nothing about what you wrap your
bytes in. The health-certificate envelope is a separate specification in the
same IG (`hcert_spec.md`). A **document package is not a health
certificate**: whether a manifest signature can be expressed in a form GDHCN
verifiers recognise is open; where a verifier gets the key is settled.

### The trustlist is a DID document, served from a CDN

- Key material is published as **DID documents** ([W3C DID Core](https://www.w3.org/TR/did-core/)), as `did.json`.
- **Two variants.** *Embedded* carries the keys inline in `verificationMethod`
  and supports immediate verification. *By reference* carries only DID ids to
  resolve, which keeps the root document concise and supports dynamic
  discovery.
- **Three environments** — DEV, UAT, PROD — each with both variants. PROD:
  `https://tng-cdn.who.int/v2/trustlist/did.json` and
  `…/v2/trustlist-ref/did.json`.
- **The path is a hierarchical filter**:
  `…/v2/trustlist/$domain/$participant/$usage/did.json`, the levels ANDed, with
  `-` as a wildcard at any level. A verifier fetches exactly the slice it
  needs rather than the whole list.
- `$domain`, `$participant` and `$usage` are **FHIR ValueSets in the IG**, not
  free text.

**WHO's trust network distributes its trust anchors as static JSON from a
CDN**, so a portal that can fetch a package from a cache can fetch its trust
anchors the same way, and the hierarchical path keeps that cheap. The *by
reference* variant exists because resolving a slice is the normal case.

Onboarding is a documented process (`concepts_onboarding.md`, with its own
[checklist](https://smart.who.int/trust/concepts_onboarding_checklist.html)).
Still open:

| still open | where it is specified |
|---|---|
| key rotation and revocation, and what a published package must do when a key is withdrawn | `concepts_certificate_governance.md` |
| whether a document-package signature can be expressed for GDHCN verifiers at all | `hcert_spec.md` is for health certificates; nothing here covers arbitrary files |
| how the gateway relates to the CDN, and who publishes to it | `trust_network_gateway_architecture.md` |

Read those before designing stage 4. **Write nothing about GDHCN from general
knowledge** — read it off the IG, because a plausible account from memory gets
wrong exactly the part (envelope versus key distribution) that decides stage 4.

## Package or per-asset: still a choice, and the trustlist does not make it

| | signs | a verifier needs | breaks when |
|---|---|---|---|
| **package signature** | one manifest listing every file and its digest | the manifest, the signature, one public key | any file changes — the whole package is re-signed |
| **per-asset signature** | each file independently | the file, its signature, one public key | only that file — the rest stay valid |

A package signature is cheaper to produce and verifies the *set*: a reader
learns that no file was added, removed or altered. A per-asset signature
verifies each file on its own, which is what an edge cache serving one asset to
one reader can check — but it cannot detect a file that was *removed*, because
there is nothing left to verify.

**They compose**: per-asset signatures with a signed manifest over them gives
both properties. That is the safer default and the more expensive one, and it
is a deployment decision. A trustlist does not constrain what is signed with
its keys; any constraint comes from the envelope a GDHCN-aware verifier reads
— the open question that decides stage 4.

## Related

- [`kg-export`](kg-export.md) — stage 2, already built. Host-agnostic by
  design, and nothing in it should name a host.
- The **publication** gates — (chief) editor signoff → merge → human eyes on
  the rendered artefact → publish — say who may publish; this skill is what
  is published.
- [`asset-extraction`](../../../library/skills/library-core/asset-extraction.md) §"Derived renderings" — what a
  package may contain that the source never supplied, and how it must say so.
- The IRIS replica — the worked example, with its own page under the IRIS replica's `docs/`.
