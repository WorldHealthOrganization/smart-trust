---
name: generalise-the-fix
description: >
  You have a fix. Before it ships, ask what CLASS of defect it belongs to and
  whether the fix sits at the right layer — then attack your own answer: name
  what the fix now catches that the bug did not. Two axes go wrong, SCOPE and
  STATE, and widening either past the problem is how a fix becomes the next
  defect. Applies to a bug fix, a schema change, a detector, or a claim in a
  paper. Use after the fix works and before the pull request.
user_invocable: true
---

# Generalise the fix, then attack the generalisation

A fix that repairs one instance and leaves its siblings is half a fix. A fix
widened past the problem it solves is the next defect. **This skill is the
pass between those two**, and it is two moves in order — generalise, then
adversary — because the adversary has no subject until a generalisation
exists.

Run it when the fix works and before the pull request. Not while debugging:
this asks what the defect **was**, which you cannot answer until you know.

---

## Move 1 — what class is this?

Three questions, in order. The first is the one that is usually skipped.

### 1.1 What was the defect, as opposed to the symptom?

The symptom is where you noticed it. The defect is the rule that was wrong.
They are rarely the same, and the fix belongs at the defect.

> **Symptom:** two work items reported as having no options.
> **Defect:** the counter recognised one markdown form — top-level list items —
> while MADR, the authority, is format-agnostic. The corpus was fine; the
> detector had invented a requirement. Fixing the two work items would have left the
> rule free to misjudge the next one.

**The tell that you are fixing a symptom:** the fix names a specific instance
— two work item ids in a rule, `document-ingestion.html` in a selector, one
filename in a condition.

### 1.2 What else has this shape?

Look, do not guess. The corpus answers this and your memory does not.

> The same detector. A twelve-bean sweep over the store found **ten** using
> list items, **two** using bold enumerations — and one using subheadings and
> being **over-counted ten for four options**. The sweep found a second
> error direction nobody had reported, and it changed the design: three forms,
> most structured wins, *never summed*.

A fix designed from one example handles one example. A fix designed from the
sweep handles the class, and the sweep is usually one command.

### 1.2a A sweep must report its own coverage

The sweep in 1.2 is a measurement, so it answers to the same rule every other
measurement here does: **say what you covered, or a silent under-match reads as
a clean corpus.**

> Sweeping the health checks for more findings whose
> action could not clear them. The first pass regex-matched `action:` followed
> by string literals and reported **6 actions, all sound**. The file has
> **15**. The nine it missed included a ternary, and the pass would have
> concluded the class was closed after seeing 40 % of it — while looking for
> exactly that kind of blind spot.
>
> The fix is one line of output: `parsed 15 of 15`. The count of subjects found
> against the count that exist, printed beside the verdict.

So a corpus sweep prints the denominator. `grep -c` for the crude marker, parse
for the real one, and show both — if they disagree, the parse is the thing to
fix before reading anything into the result. This is
[`rendered-verification`](../../../skills/ui/ui-core/rendered-verification.md)'s "assert the conditions"
rule with the browser taken out of it: **a check that cannot tell an empty walk
from a clean one is not a check.**

### 1.3 Is the fix at the right layer?

Walk outward from the symptom until you reach the thing that is actually
wrong, and stop there. Both directions are failures: too deep and the siblings
stay broken, too high and see Move 2.

> The search field was 44 % of its panel. Our rules said `width: 100 %`
> and `flex: 1 1 auto` and they were all correct — walking the box chain found
> the theme's own `.search-input-wrap` at `max-width: 536px`, two layers above
> where the change felt like it belonged.

---

## Move 2 — the adversary

Now attack what you just wrote. **One question, and answer it in writing:**

> **What does this fix now apply to that the defect did not?**

If the honest answer is "nothing", say so and move on — the pass is cheap when
it passes. If it is anything else, that is the list to justify or narrow.

### The two axes, and they go wrong independently

Most over-generalisation is one of these, and the worked case below is both
at once.

| axis | the question | widened past the problem looks like |
|---|---|---|
| **SCOPE** | *which* things does it apply to? | the fix names a container when the problem was one child |
| **STATE** | *when* does it apply? | the fix is unconditional when the conflict only arises in one state |

> The worked case. A rule was written so ONE panel could paint over a
> full-bleed figure. It was applied to **the whole sidebar** (scope) in **every
> state** (state), as `:root.fa-has-fullwidth .side-bar { z-index: auto }`. At
> specificity (0,3,0) it beat the open-nav rule's (0,2,0) always — so on every
> page with a wide figure the navigation opened *behind the page content*, which
> the open-nav rule's own comment had predicted in as many words.
>
> Neither axis needed widening. The panel is `position: fixed`; only the panel
> was in conflict; and only while a figure was expanded.

### Four tells, all cheap to check

1. **The fix names a container, the bug named a child.** `.side-bar` when the
   problem was `.fa-qr-panel`.
2. **The fix is unconditional and the conflict is not.** Ask when the defect can
   occur. If the fix is broader than that window, narrow it or say why not.
3. **You summed where you should have chosen.** Recognising three forms is
   right; adding their counts gave one work item **14 options where it has 4**. When
   alternatives are alternatives, take the most specific present — do not add.
4. **The label is doing work the relation should do.** A stale-claim check
   keys on `parent` rather than `type: epic`, because `type` is a label a work item sets about
   *itself* while `parent` is a fact another work item asserts about it. Keying on
   the label would also have forced a ruling on what `feature` means.

### Keep the discrimination the check exists for

A generalisation that excuses everything has deleted the check. Name the case
that must STILL fire, and test it.

> The stale-claim check excuses a claim whose child moved recently. The case
> that must still fire: a parent **all** of whose children are also quiet —
> 8 open children, none moving — and it has a test of its own. Without it
> the change would have excused every parent.

### The strongest outcome is when the adversary reverses you

Expect to find a trade, and measure it rather than reasoning about it.

> The sidebar case. I expected `z-index: 100` to fix the nav **at the cost of** the panel
> the old rule protected, so I synthesised that panel and measured. Under `auto`
> it was **not visible at its own centre** — covered despite its `z-index: 1200`.
> Under `100` it was. The old value failed the case it was written for, so the
> new one was better on both counts and there was no trade to weigh.

An adversarial pass that only ever confirms you is not being run.

---

## Move 3 — falsify the guard

A guard that would not have caught the bug is worth nothing, and you cannot
tell by reading it.

**Reintroduce the defect, watch the guard fail, restore, watch it pass.** Two
commands.

> The sidebar case: `sed` the value back to `auto` → both assertions fail;
> restore → 25 pass. A health finding: it fired before, is silent after, and the adjudicated
> group is still counted so "never created" and "all resolved" cannot read the
> same.

If the guard cannot be falsified — because the defect needs a state you cannot
produce — say so where the guard lives, and say what does cover it instead.

---

## Where this is NOT a bug fix

The moves are the same; only the vocabulary changes.

- **A schema or model change.** Scope is *which records must now satisfy this*;
  state is *from when*. A field made required is a fix applied unconditionally
  to every record ever written — the sidebar shape in a schema.
- **A detector or gate.** Its class is the set of inputs it judges. Sweep the
  corpus (1.2) before changing the rule, or you will tune it to the two
  examples in front of you.
- **A claim in a paper.** The generalisation is the theorem's hypothesis; the
  adversary asks which objects now satisfy it that the proof does not cover.
  The falsification is the counterexample you look for on purpose. Widening a
  hypothesis past what the argument supports is over-generalisation with a
  different name.

---

## What this deliberately does not do

**It does not ask you to generalise everything.** "Nothing else has this shape"
is a complete and common answer to 1.2, and one worked example is not a class.
The cost of the pass is a few minutes; the cost of inventing a class that is
not there is a rule nobody can satisfy.

**It does not replace [`rendered-verification`](../../../skills/ui/ui-core/rendered-verification.md) or a
test.** It asks whether the fix is aimed correctly. Whether it *works* is a
different question and comes first.

**It does not decide a trade the owner should decide.** When narrowing the
generalisation costs something real — say, a corner magnifier under the
staging banner, where raising it defeats the banner and lowering it costs
the position — report the measurement and the two options rather than picking.
