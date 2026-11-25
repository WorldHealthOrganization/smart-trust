---
name: feedback-deep-links
description: >-
  The deep-link rule for every request for feedback, review, sign-off or
  acceptance on something rendered: carry the staging preview, one deep link
  per changed page with the same page on main, pages taken from the change
  rather than chosen, the third state said rather than hidden, and the request
  placed where the person will look.
---

# The deep-link rule — every request for feedback

> Skill id: `feedback-deep-links` · Package: `content-lifecycle`


**This is the one home of the rule.** It moved here from `staging-review` on 2026-11-10 (owner, card Q-SG-2 option A), so a layer that leaves the opt-in `sdlc` sub-graph off still has it; `staging-review` builds the links it asks for. Every skill or process that asks a person
for feedback, review, sign-off or acceptance on something rendered (CRDM,
SDLC code review, content authoring, translation, wireframes, a DAK or a
guideline) points here rather than restating it.

1. **When a staging preview exists, the request carries it.** A request for
   feedback with a PR link and no staging link asks the person to read source
   in place of the thing they are judging.
2. **One deep link per changed thing**: the page, and the anchor on it where
   the change sits (`…/branches/<slug>/<path>#<anchor>`), each with the same
   page on main as **before** (or "new page"). The site root is the right link
   only for a change to the landing page itself.
3. **The pages come from the change, not from judgement.** Start from the
   preview's changes page, `…/branches/<slug>/changes/`, when the build wrote
   one: the changed sources, the rendered files in their dependency cone, and
   the files that differ from the published root but were NOT in the cone
   (each of those is a page to list, and a cone defect to report). Otherwise read
   `rendered-impact.json` beside the preview when the staging build wrote one
   (skill `rendered-impact` (opt-in `cat-harness.sdlc`)), or run the renderer's
   impact Tool for the branch. Never build a URL from a source path: look each
   one up in the publish ref (`staging-review` §"You can open it yourself").
4. **The third state is said, not hidden.** No preview yet: say so, and when it
   will exist. A changed page the publish ref does not hold: a finding, listed
   with the others. No page list could be computed: say that, never "nothing
   changed".
5. **Where it goes is a judgement, and more than one place may be right.**
   Human feedback is gathered through several Tools: the agent conversation
   (the turn that asks the person), a GitHub issue, a pull request (its body,
   or the comment the staging workflow posts). Which to use is a judgement
   about context, and more than one can be used. Ask where the person will
   look. Work driven through, or primarily
   referencing, a GitHub issue may warrant the request on that issue as well
   as in the turn; a change reviewed on its PR carries it there. Whichever
   places are chosen, each carries the same deep links. This rule fixes what
   a request contains, not a list of places it must be posted.

A skill whose output asks for feedback declares it: its output schema carries a
`stagingLinks` field of type `StagingComparison` (`schemas/sdlc/staging.ts`), and
a skill that consumes feedback takes the same field as input, so the links
travel with the request rather than being rebuilt.
