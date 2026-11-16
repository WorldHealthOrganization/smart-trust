---
layout: default
title: Home
nav_order: 1
lang: en
description: "WHO IRIS, catalogued by reference — an ingested copy, not WHO and not live."
permalink: /docs/
---

{% include landing.html %}

# WHO IRIS
{: .fs-9 }

The WHO Institutional Repository for Information Sharing, **catalogued by
reference**: the shape of the corpus is modelled here, and only a handful of
its items are held.
{: .fs-6 .fw-300 }

[The IRIS-style home]({{ '/' | relative_url }}){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[The catalogue, as a graph]({{ '/docs/who-iris/' | relative_url }}){: .btn .fs-5 .mb-4 .mb-md-0 }

{% include harness_details.html %}

## What this site is

- **[The IRIS-style home]({{ '/' | relative_url }})** — IRIS's home page,
  rendered from this repository's catalogue and themed as IRIS, at this
  site's root. Each held item links to its library entry page; communities
  and collections go to the catalogue page.
  It is an **ingested copy**: not WHO, and not live.
- **[The catalogue]({{ '/docs/who-iris/' | relative_url }})** — what the
  catalogue knows, and what it records that it does not know. Every node
  declares whether its bytes are here (`materialized`), elsewhere
  (`referenced`) or unestablished (`unknown`), and there is no default.
- **The gap is the point.** IRIS reports its own figures for items and files;
  the catalogue holds a few and models the rest by reference. The census is
  `bun run check:catalogue`, never a number written into a page.

This repository is the development home of the instance; an official copy is
expected to live under WHO's own account.
