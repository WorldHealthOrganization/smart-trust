---
title: "Upstream report draft: CDHIv1toCDHIv2 is incomplete"
description: "A draft issue for WorldHealthOrganization/smart-base. The CDHIv1toCDHIv2 ConceptMap stops partway through group 4 and never emits the unmatched rows its description promises. Saved for the owner to file. Not posted."
nav_exclude: true
---

# Upstream report draft: `CDHIv1toCDHIv2` is incomplete

> **Status: DRAFT, not filed.** Bean `folio-assistant-cpmo`. Owner ruling,
> 2026-10-03: **"Keep by reference, report upstream"**. The crosswalks stay
> `referenced` in `smart-base/fhir-artifact-index/` and are not materialized
> here. This file is the report, written for the owner to file. **No agent
> posts it upstream.**
>
> To file it, open a new issue at
> <https://github.com/WorldHealthOrganization/smart-base/issues/new> and paste
> everything below the line as the body, under the title shown.

Every citation below is pinned to `WorldHealthOrganization/smart-base` `main`
at commit `5891a220e8ebbbd2d107282876a085641c5c767f`, read 2026-10-03. The
line numbers are for these files at that commit:

| file | sha256 at that commit |
|---|---|
| `input/fsh/conceptmaps/CDHIv1toCDHIv2.fsh` | `e261c83d612f7d4eb9ae8de86a2fb3c6d90592b9ea5b7928e2cb8a408ad5d974` |
| `input/fsh/codesystems/CDHIv1.fsh` | `09ce5ba9e9828e3dfab3a2c5e744ccd394524b7ebd34331daa5a61847a57c43e` |
| `input/fsh/codesystems/CDHIv2.fsh` | `610c240c33eab334f9b512c7b98e8b644d0b9fec8186d38e0ba0fa40003aee4d` |

How the counts were made: every `* #<code>` concept line in the two
CodeSystems was compared with every `insert ElementMap(…)` /
`insert ElementMapComment(…)` row in the ConceptMap, matching on exact code
strings. There are 119 v1 codes, 138 v2 codes and 120 map rows. Each map row
names a real code on both sides.

---

**Title:** `CDHIv1toCDHIv2`: map stops after 4.4, has no row for v1 3.5.3, and never lists the "unmatched" v2 codes its description promises

### Summary

`ConceptMap/CDHIv1toCDHIv2` (`status = #draft`, `experimental = true`) is
incomplete against its own description in three ways:

1. **It stops partway through group 4.** The last row maps v1 `4.4.1` to v2
   `4.4.3`
   ([`CDHIv1toCDHIv2.fsh` L164](https://github.com/WorldHealthOrganization/smart-base/blob/5891a220e8ebbbd2d107282876a085641c5c767f/input/fsh/conceptmaps/CDHIv1toCDHIv2.fsh#L164)).
   Nothing targets v2 `4.3.5` or any of `4.5`, `4.5.1`–`4.5.4`
   ([`CDHIv2.fsh` L159, L164–L168](https://github.com/WorldHealthOrganization/smart-base/blob/5891a220e8ebbbd2d107282876a085641c5c767f/input/fsh/codesystems/CDHIv2.fsh#L159-L168)).
   Yet the description says "4.3 expanded from 4 to 5 codes … 4.5 is entirely
   new"
   ([L16–L17](https://github.com/WorldHealthOrganization/smart-base/blob/5891a220e8ebbbd2d107282876a085641c5c767f/input/fsh/conceptmaps/CDHIv1toCDHIv2.fsh#L16-L17)).

2. **The promised "unmatched" entries never appear.** The description says
   "New v2 categories with no v1 equivalent are listed as 'unmatched' targets"
   ([L18](https://github.com/WorldHealthOrganization/smart-base/blob/5891a220e8ebbbd2d107282876a085641c5c767f/input/fsh/conceptmaps/CDHIv1toCDHIv2.fsh#L18)).
   That line is the only place the word `unmatched` occurs in the file. These
   **22** v2 codes are the target of no row:

   `1.4.4`, `1.6.2`, `1.8`, `1.8.1`, `2.5.6`, `2.11`, `2.11.1`, `2.11.2`,
   `3.1.5`, `3.5.3`, `3.5.7`, `3.5.8`, `3.8`, `3.8.1`, `3.8.2`, `3.8.3`,
   `4.3.5`, `4.5`, `4.5.1`, `4.5.2`, `4.5.3`, `4.5.4`.

3. **v1 `3.5.3` has no row at all.** v1 `3.5.3` "Track and manage insurance
   reimbursement"
   ([`CDHIv1.fsh` L99](https://github.com/WorldHealthOrganization/smart-base/blob/5891a220e8ebbbd2d107282876a085641c5c767f/input/fsh/codesystems/CDHIv1.fsh#L99))
   is the only v1 code that no row maps from. The description says "v1
   3.5.3–3.5.6 shifted by one (now 3.5.4–3.5.6 + new 3.5.3)"
   ([L14–L15](https://github.com/WorldHealthOrganization/smart-base/blob/5891a220e8ebbbd2d107282876a085641c5c767f/input/fsh/conceptmaps/CDHIv1toCDHIv2.fsh#L14-L15)).
   But the rows map `3.5.4 → 3.5.4`, `3.5.5 → 3.5.5` and `3.5.6 → 3.5.6`, each
   with the comment "Renumbered from v1 3.5.x"
   ([L135–L137](https://github.com/WorldHealthOrganization/smart-base/blob/5891a220e8ebbbd2d107282876a085641c5c767f/input/fsh/conceptmaps/CDHIv1toCDHIv2.fsh#L135-L137)).
   So the numbers do not shift, and v1 `3.5.3` drops out. Either the
   description or the rows are wrong. We cannot tell which from the files
   alone.

### Why it matters

A consumer resolving a v1 code to v2 gets no answer for v1 `3.5.3`. It cannot
tell that answer apart from an error. A consumer asking "which v2 codes are new
since v1?" gets no answer from this map, though its description says that is
what it provides.

### A note on how "unmatched" can be expressed in R4

In FHIR R4, `ConceptMap.group.element.code` is a **source** code. The
equivalence `unmatched` means that source code has no match in the target
system. A v2-only code is not a v1 code, so it cannot be an element of a
v1 → v2 map. Two ways to keep the description's promise:

- add a reverse map, `CDHIv2toCDHIv1`, in which each of the 22 codes above is
  an element with `target.equivalence = #unmatched`; or
- reword the description to point at `CodeSystem/CDHIv2`'s own list of new
  categories
  ([`CDHIv2.fsh` L13](https://github.com/WorldHealthOrganization/smart-base/blob/5891a220e8ebbbd2d107282876a085641c5c767f/input/fsh/codesystems/CDHIv2.fsh#L13)).

v1 `3.5.3` is a source code, so it can and should get a row in this map: a
target if one fits, otherwise `#unmatched`.

A smaller point: the `CDHIv2` list of new categories at L13 names 13 codes.
Two of them, `4.4.2` and `4.4.3`, are **targeted** by this map (as `wider`
from v1 `4.4.1`, L163–L164). One of the 22 untargeted codes, v2 `3.5.3`, is
not on that list. The two "new since v1" lists should agree.

### Suggested change

- Add rows (or an explicit decision) for v2 `4.3.5` and `4.5`–`4.5.4`.
- Add a row for v1 `3.5.3`, and make the 3.5.x description agree with the rows.
- Either add `CDHIv2toCDHIv1` carrying the 22 `#unmatched` elements, or reword
  L18.
