---
# note on folio-assistant-fs43 from claude/blissful-ride-c2f26u-rename-script
$schema: folio-bean-note/v1
bean: folio-assistant-fs43
branch: "claude/blissful-ride-c2f26u-rename-script"
created: "2026-10-02"
---
## special-branch naming ruling: cat/<harness>/<name> (for 32f6)

## Naming ruling: `cat/<harness>/<name>` replaces `cat-<name>`

(Recorded on epic `fs43` because bean `32f6` reaches main only with train 6, #1924. This ruling is for 32f6.)

Owner, 2026-10-02, verbatim: "actually should they better be cat/fhir-harness , cat/state ? will this align better to named subgraphs? ...and github UI, or so?". The owner then chose option 1, **`cat/<harness>/<name>`**, over `cat/<name>` and over keeping `cat-<name>`.

**Why:**
- The branch path mirrors the named-subgraph IRI `<BASE>/subgraph/<HARNESS>/<NAME>/` (epic `whlc`, bean `c1m4`), so one rule maps a branch to its subgraph and back.
- In GitHub, one ruleset pattern, `cat/**`, covers every special branch. With `cat-`, two were needed, because `*` does not cross `/`.
- Desktop git tools show `cat/` as a folder.

**Correction, written the same hour:** bean `46qw` had already run before this ruling reached it. It moved `state` → `cat-state` and `fhir-ast/*` → `cat-fhir-ast/*` (verified, and the old names are gone). Bean `tlk2` moves those three branches to their final names.

| id | legacy | new name | harness (from the instance declarations) |
|---|---|---|---|
| state | `state` | `cat/cat-harness/state` | cat-harness |
| qa-reports | `qa-reports` | `cat/cat-harness/qa-reports` | cat-harness |
| fsh-guts (bean 9c7h) | — (the directory `fsh-guts/`) | `cat/cat-harness/fsh-guts` | cat-harness |
| fhir-ast | `fhir-ast/<ig>` | `cat/fhir-harness/fhir-ast/<ig>` | fhir-harness |
| lake-cache | `lake-cache/<pkg>` | `cat/folio-assistant-sci/lake-cache/<pkg>` | **proposed.** No harness declares it. The Lean caches serve paper folios, and the placement audit moves the lake-cache templates to folio-assistant-sci. To be confirmed |
| gh-pages | `gh-pages` | unchanged | GitHub Pages serves it by name |

**Follow-up**, on #1928 after train 6 (#1924, carrying #1913) lands:
- update `special-branches.json` and its mirrors (`lake-cache.sh`, `lake-cache-fetch.sh`, …) to the new names;
- tell the #1816 session (fhir-ast dual-name);
- then post `folio-assistant-46qw: resume` for the executor.

`qa-reports` still waits on bean zlq9.
