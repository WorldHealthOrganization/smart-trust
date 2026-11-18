---
# note on folio-assistant-zacz from claude/merge-refusal-handback
$schema: folio-bean-note/v1
bean: folio-assistant-zacz
branch: "claude/merge-refusal-handback"
created: "2026-10-02"
---
## handover

Handover, 2026-10-02.

1. Where it is going: the owner's request ("a merge in queue that cannot be merged gets a bean, a hand-back to the sibling with a fail condition, or a dispatched agent") is written into the merge-conflict-patterns skill and executed by processes/sdlc/merge-refusal.bpmn. Draft PR #1888, to be marked ready when green; never merged by this session, and no `merge-main` label.

2. Done:
- the skill section, merge-conflict-patterns §"When a merge-train member is refused" (five steps: bean, hand back with a fail condition, dispatch, one PR comment, close);
- processes/sdlc/merge-refusal.bpmn, its SVG, and a row in publication-workflow.md;
- skill:register, readme:subgraphs and render:bpmn, with all three checks green;
- origin/main merged twice, first #1875 and then train 4 (#1893). The last merge is 393decf, pushed;
- regen after that merge: 93 current, 0 regenerated.

Next:
- the result of `bun run cat gates` on 393decf, which is running locally;
- then mark #1888 ready via POST /repos/litlfred/folio-assistant/pulls/1888/ccr/ready_for_review once CI is green.

3. Bean folio-assistant-zacz, PR #1888, branch claude/merge-refusal-handback. The main merge is complete, with no conflicts outstanding.

4. Blockers:
- the copy of `nok9` is resolved: it is byte-identical to main's after #1887 landed;
- the gates have not finished yet, and each regen or gates run takes about 10–30 min on this container.
