---
# folio-assistant-akjg
$schema: bean/1.0.0
title: 'DOCS-POPULATED HAS NO SUBJECT TEST: the gate passes smart-trust on docs/category/Other.md — length and authorship have teeth, 06e3 §4(b) processes/roles/tasks half was never built'
status: completed
type: bug
priority: normal
created_at: 2026-10-03T13:50:38Z
updated_at: 2026-10-03T14:22:22Z
parent: folio-assistant-0lmb
---

`check:docs-populated` (`scripts/check-docs-populated.ts`, 2026-10-02, gated at
`code-quality-gates.yml:1846`) implements half of `06e3` §4(b) and reports the
other half as if it were not asked.

Owner, `06e3` §4(b), both halves in one sentence:

> does the page reference the harness's **processes, roles and tasks**, and does
> it say something about them that the index does not?

Built: **length** (`MIN_PROSE_WORDS = 250`, with its basis) and **authorship**
(a generated page cannot clear the bar). Not built: **subject** — nothing asks
what the page is ABOUT.

## Measured, not asserted — what the gate passes on today

`bun run cat check:docs-populated` on `main`, 2026-10-03, exit 0:

| harness | the page it passes on | words |
|---|---|---|
| `folio-assistant` | `docs/README.md` | 299 |
| `cat-harness` | `docs/proposals/placement-audit-2026-10-01.md` | 17605 |
| `smart-base` | `smart-base/docs/index.md` | 5397 |
| `smart-immunizations` | `docs/category/Knowledge_Artifacts__Libraries.md` | 6124 |
| `smart-trust` | **`docs/category/Other.md`** | 14158 |
| `who-iris` | `who-iris/docs/kg-to-portal.html` | 1491 |

A page named `Other.md` clears a bar whose own words are *"at least one
meaningfully popualated doc page that outlines what the harness does"*. So does
a placement-audit proposal. **This is the `xom7` shape one level up**: the
check has teeth about how long a page is and none about what it is for, and a
harness with no landing page is indistinguishable from one that has a good one.

## Done when
- [x] a `subject` dimension: does **ONE** page name a declared **process**, a declared **role** and a declared **task** of that harness, as three DISTINCT names
- [x] resolved from each instance's own declaration (`processes` and `scenarios` graph kinds, `readRoleGraph`, the task regex `index/tasks` uses) — never a list in this file
- [x] three states on the new half too: a harness declaring none of the three is `unknown`, never a pass — and a graph that does not PARSE is `unreadable` rather than absent
- [x] reported per harness, and fatal only under `--strict`
- [x] the thin-page basis and the `ambiguous` reporting of the existing half are left exactly as they are

## CORRECTION — "all six fail" was wrong, and the real result is more interesting

This bean and PR #1998 both opened saying every harness would fail the new half.
**Measured after building it: 1 populated, 5 unknown, 0 thin.** The claim was
made before the resolver existed and is withdrawn here rather than left standing.

| harness | subject | declared processes / roles / tasks |
|---|---|---|
| `cat-harness` | **populated** — `docs/methodologies/index.md` | 61 / 98 / 403 |
| `smart-base` | unknown | 2 / **0** / 19 |
| `folio-assistant` | unknown | 0 / 0 / 0 |
| `smart-immunizations` | unknown | 0 / 0 / 0 |
| `smart-trust` | unknown | 0 / 0 / 0 |
| `who-iris` | unknown | 0 / 0 / 0 |

Verified against the declarations themselves, not inferred from the output: four
of those instances declare **no `processes` and no `scenarios` directory at all**,
and `smart-base` declares processes but no role graph. So for five of six the
question §4(b) asks **cannot be put**, and that is a fact about the DECLARATIONS
rather than about the pages. Which also answers the falsifier I stated before
starting — *"if a harness's processes aren't nameable from its declarations, the
dimension can only report unknown for everyone"*: it does not, because the one
instance that declares them resolves 61 processes, 98 roles and 403 tasks and
passes on a real page.

## Why it is NOT fatal today, deliberately

Gating this would fail five harnesses for graphs they never claimed to have, and
the sixth is already green. The remaining red belongs to `06e3` §4(a) — writing
the landing pages — a different item the owner has not picked. Making it fatal
here would put (a)'s red on an unrelated PR and make the gate set unbisectable
for everyone else.

So it follows this repository's own split: `audit:coverage:require-all` reports
and `audit:coverage:strict` grades. The non-strict run stays green and names the
finding; `--strict` is what (a) turns on when the pages exist.

**That is a deferral with a named owner, not a shrug.** The finding is printed
every run, so the gap cannot go quiet the way `xom7` did for two months.

## Built 2026-10-03 — `claude/docs-populated-subject`, PR #1998

Four cracks closed, each found by MEASURING the corpus rather than by reasoning:

| crack | what it let through |
|---|---|
| two different pages | the length half on page A, the subject half on page B — a harness clearing a bar no single page of its own meets |
| one token, three dimensions | `Adjudication` is a process name AND a task name, so `docs/methodologies/index.md` scored 3 on one word |
| sort order as a verdict | it reported `docs/ar/architecture.md`, an ARABIC TRANSLATION, because `ar/` precedes `architecture/` and the loop broke on the first full hit |
| a short name matches prose | a role id like `BA` would make every page a pass |

Plus one the tests caught in my own reporting: the "how close did it come"
message counted a task that was the same string as the process, printing *"a
process and a role and a task"* about a page naming two things.

And one in my own code, exposed by the mutation check rather than by reading it:
the distinctness rule was enforced **twice** — once in the triple search and
again via `new Set(...).size === 3` — so removing it from the search left every
test green. Two mechanisms for one rule means one is dead, and a dead mechanism
cannot be tested. The search is now the only answer.

**Mutation-checked, all six rules.** Removing the distinctness condition, the
four-character guard, the eligibility filter, the ranking tiebreak, the
unreadable/absent split, or the `scenarios` resolution each turns a NAMED test
red. 23 pass, including a planted instance (declaration + BPMN + role graph) so
the resolver is tested against a real `readDeclaration` rather than a mock of it.

## Closed 2026-10-03 — landed in PR #2002, merge commit `27e2a46350`

Closed on **evidence, not authorship** (`bean-coordination` §"Closing a bean
whose work has already landed"). What was verified on `main` rather than assumed
from the merge notification:

- both commits are ancestors of `main`: `1ddfca1988` (the implementation) and
  `d08d038a5f` (the correction);
- the code is really there — `subjectsOf` at `check-docs-populated.ts:214`, the
  §SUBJECT docblock at `:62`, `assessSubject` referenced three times;
- every Done-when box above is ticked on `main`'s copy of this file.

The check-before-closing mattered: **#1998 merged at its FIRST commit** (the bean
alone) while three more were already pushed to its branch, which is the whole
reason #2002 existed. A merge notification says a PR merged; it does not say
which sha it took. The `ready:` marker on #2002 named that risk in advance, and
the verification above is what closes it.

Final measurement on `main`: **1 populated, 5 unknown, 0 thin.** `--strict` is
what `06e3` §4(a) turns on when the landing pages exist.
