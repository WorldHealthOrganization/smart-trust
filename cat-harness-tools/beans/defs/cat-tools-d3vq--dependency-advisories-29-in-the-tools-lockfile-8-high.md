---
# cat-tools-d3vq
$schema: bean/1.0.0
title: 'DEPENDENCY ADVISORIES: bun audit reports 29 in the cat-harness-tools lockfile (8 high), including an undici TLS validation bypass under jsonld'
status: completed
type: bug
priority: high
created_at: 2026-10-31T04:05:00Z
updated_at: 2026-10-31T08:50:00Z
parent: cat-tools-sr31
---

RED FLAG category: `security`. Severity: major. Rule: `scz-review-dependency-changes`.

`bun audit` in cat-harness-tools at the 2026-10-31 head: **29 vulnerabilities (8 high, 15 moderate, 6 low)**. cat-harness: none (35 packages).

High ones:

- `undici@5.29.0` via `jsonld > @digitalbazaar/http-client`: GHSA-2m5v-pch6-74hx (TLS certificate validation bypass via dropped tls options), GHSA-qrxm-fqhp-jwvm, GHSA-vrm6-8vpv-qv8q, GHSA-v9p9-hfj2-hcw8, GHSA-vxpw-j846-p89q. jsonld's document loader fetches remote contexts with this client.
- `zod@4.6.5` (direct dependency): GHSA-mrhx-c7xc-m3w5, memory exhaustion on oversized constrained collections. Fixed in 4.6.6.
- `body-parser@2.3.0`: GHSA-27r3-jxmh-p828. `@fastify/busboy@2.1.1`: GHSA-x8mw-p69m-v3mx.

Low: `katex` 0.16.47 and 0.18.11 (GHSA-238p-pmpm-9mq7, trust bypass via existing prototype pollution).

Also: `check:dependency-advisories` reports UNDETERMINED from a layer checkout, so nothing in the layer's own CI shows these (see cat-tools-q8gk).

## Done when

- [x] `bun audit fix` within ranges, zod to 4.6.6+, and a jsonld path that does not pull undici 5 (override, or a pinned document loader).
- [x] `bun audit` shows no high advisories. (29 → 3: 0 high, 2 moderate, 1 low; the 3 left need a major bump)
