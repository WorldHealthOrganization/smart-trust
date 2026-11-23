---
# folio-assistant-s36s
$schema: bean/1.0.0
title: 'SWEEP COVERAGE: a corpus sweep that silently under-matches reports a clean corpus — found while sweeping for exactly that'
status: completed
type: bug
priority: normal
created_at: 2026-09-23T22:14:41Z
updated_at: 2026-09-23T22:14:57Z
parent: folio-assistant-1xhc
---

Four findings this session had prescribed actions that could not clear them —
`o5qj`, `thux`, `vq8g`, `7umv`. Four is a class, so `generalise-the-fix` Move 1.2
says to sweep for siblings rather than stop at the fourth instance.

## The sweep

Every `action:` in `cat-harness/test/health/checks.ts`, asked one question: **can
the mechanism this names reach the subject this finding can have?**

**Result: no further instances.** All 15 name reachable mechanisms — a command,
a dispatch, a person's decision, an edit to the bean. The four repaired today
are now among them. A negative result is a real result, and this skill's own
text says so: *"nothing else has this shape" is a complete and common answer.*

The one that looked suspicious was the `bean-thin-decision-records` action,
which still says *"or drop the section"* — the sentence `vq8g` proved dangerous.
It is correct as written: `vq8g` fixed the MISCLASSIFICATION, so the action now
only reaches a genuine zero, and for a genuine zero the advice is right.

## What the sweep actually found — in itself

The first pass regex-matched `action:` followed by string literals and reported
**6 actions, all sound**. The file has **15**. The nine it missed included a
ternary.

So the pass would have concluded the class was closed **after seeing 40 % of
it**, while looking for exactly that kind of blind spot. The tell was cheap:
`grep -c 'action:'` says 15.

The rule that falls out, now in `generalise-the-fix` §1.2a: **a corpus sweep
prints its own denominator.** The crude count beside the parsed count; if they
disagree, fix the parse before reading anything into the result. It is
`rendered-verification`'s *"assert the conditions"* with the browser taken out —
a check that cannot tell an empty walk from a clean one is not a check.

Same shape as `dh4f`, and the third time in this session a verdict was produced
over a corpus the tool could not read: the browser PASS over a page with zero
stylesheets, the archive census taken against the wrong directory, and this.

## Done when

- [x] Every action in the health checks is assessed against its own subject
- [x] The sweep reports its coverage, not just its verdict
- [x] The negative result is recorded as a result
- [x] The under-match is written into the skill that prescribed the sweep

Parent `1xhc`.
