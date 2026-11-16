Feature: a reviewer's comment as a structured todo

  @test:schemas/review-comment.test.ts::the_kind::kindIsTodo
  Scenario: is a todo: its parent is the harness todo, and a todo reader accepts it
    When the review-comment kind is read and an ingested comment is read as a todo
    Then its kind order ends carried-note, themed, todo, review-comment
    And the todo schema accepts it

  @test:schemas/review-comment.test.ts::the_kind::targetLabelRequiredStatusClosed
  Scenario: is more structured: targetLabel is required, status is closed
    When an ingested comment without targetLabel, and one with status in_progress, are validated
    Then both are refused

  @test:schemas/review-comment.test.ts::the_lifecycle_is_closed,_and_only_process_tasks_move_it::editorAddressesThenResolves
  Scenario: the editor addresses, then resolves with a Decision
    When the editor addresses the comment and then resolves it naming decision:7
    Then it is addressed and then resolved with that decision

  @test:schemas/review-comment.test.ts::the_lifecycle_is_closed,_and_only_process_tasks_move_it::refusesIllegalMoves
  Scenario: refuses a move no task may make, a task not in the table, and a closed comment
    When the comment is moved open to resolved, by a task not in the table, by hand, and after it is closed
    Then each move throws, the last saying it is closed

  @test:schemas/review-comment.test.ts::the_lifecycle_is_closed,_and_only_process_tasks_move_it::closingNeedsDecision
  Scenario: refuses to close without the Decision, in the transition and in the schema
    When an addressed comment is resolved without a Decision
    Then the transition throws saying it names the Decision
    And the schema refuses a resolved comment without one

  @test:schemas/review-comment.test.ts::the_lifecycle_is_closed,_and_only_process_tasks_move_it::transitionsNameRealBpmnTasks
  Scenario: every transition names a BPMN task that exists
    When each review transition's BPMN file is read
    Then it holds the named process and task

  @test:schemas/review-comment.test.ts::the_tag::tagReadsBlockKindRole
  Scenario: reads block, kind and role; a label may contain colons
    When a tag with block, kind and role is parsed
    Then it gives the label with its colon, kind defect, role clinical-sme and the text

  @test:schemas/review-comment.test.ts::the_tag::tagDefaultsKindRole
  Scenario: defaults kind to question and role to reviewer
    When a tag with only a block is parsed
    Then kind is question and role reviewer

  @test:schemas/review-comment.test.ts::the_tag::untaggedIsConversation
  Scenario: an untagged comment is conversation, not a review comment; a bad tag is an error
    When untagged comments and bad tags are parsed
    Then untagged ones give null
    And two labels or an unknown kind give an error

  @test:schemas/review-comment.test.ts::ingestion::ingestOnePerTaggedComment
  Scenario: creates one todo per tagged comment, counts the rest, and says what was malformed
    When the PR's comments are ingested
    Then two todos are created, one comment is untagged and one is malformed naming "rant"
    And the first is open, human and anchored to hash h1

  @test:schemas/review-comment.test.ts::ingestion::offHeadCommentOrphaned
  Scenario: a comment on a block that is not in the head is kept, orphaned from the start
    When the comments are ingested
    Then the comment on a block not in the head has no hash and is orphaned

  @test:schemas/review-comment.test.ts::ingestion::ingestionIdempotent
  Scenario: is idempotent: a re-run creates nothing
    When the comments are ingested twice
    Then the second run creates nothing and lists both as unchanged

  @test:schemas/review-comment.test.ts::re-anchoring_across_a_ChangeSet::reanchorFollowsRename
  Scenario: follows a rename, keeps the old label, and never touches status
    Given an addressed comment on prose:overview
    When it is re-anchored across a rename to prose:summary
    Then it targets prose:summary, records prose:overview, and stays addressed

  @test:schemas/review-comment.test.ts::re-anchoring_across_a_ChangeSet::removedBlockOrphans
  Scenario: a removed block orphans the comment — kept, never dropped
    When a comment is re-anchored across the removal of its block
    Then it is kept, open and orphaned

  @test:schemas/review-comment.test.ts::re-anchoring_across_a_ChangeSet::unrelatedChangeLeavesAlone
  Scenario: an unrelated change leaves the comment alone
    When a comment is re-anchored across an unrelated addition
    Then nothing is returned as changed

  @test:schemas/review-comment.test.ts::re-anchoring_against_the_head's_blocks_(renamedFrom)::followsRenamedFrom
  Scenario: follows a block's renamedFrom — even for a block the PR itself added
    When a comment is re-anchored to head blocks where prose:summary was renamed from prose:overview
    Then it targets prose:summary and records prose:overview

  @test:schemas/review-comment.test.ts::re-anchoring_against_the_head's_blocks_(renamedFrom)::orphansAndUnorphans
  Scenario: orphans a comment whose block is gone, and un-orphans it if the block returns
    When a comment is re-anchored to blocks without its block, then with it back
    Then it is orphaned, then no longer orphaned

  @test:schemas/review-comment.test.ts::re-anchoring_against_the_head's_blocks_(renamedFrom)::returnsAnchoredUnchanged
  Scenario: returns every comment, and an anchored one unchanged
    When an anchored comment is re-anchored to blocks holding its block
    Then it is returned unchanged

  @test:schemas/review-comment.test.ts::deciding_from_the_page:_a_`resolve:`_tag_(owner,_2026-10-15)::parsesResolveTag
  Scenario: parses the tag; anything without `resolve:` is not one
    When resolve tags and other text are parsed
    Then a resolve tag gives target, decision and text
    And text without resolve gives null
    And an unknown decision or a non-id target gives an error

  @test:schemas/review-comment.test.ts::deciding_from_the_page:_a_`resolve:`_tag_(owner,_2026-10-15)::editorMovesThroughTable
  Scenario: an editor moves a comment through the table: addressed, then resolved, naming the decision comment
    When an owner tags addressed and then resolved
    Then nothing is refused and two tags are counted
    And the comment is resolved, naming the decision comment and both decisions

  @test:schemas/review-comment.test.ts::deciding_from_the_page:_a_`resolve:`_tag_(owner,_2026-10-15)::decisionsAppliedOnce
  Scenario: applies each decision once: a rebuild over its own output changes nothing
    When the same decision is applied over its own output
    Then nothing is refused or applied and the comments are unchanged

  @test:schemas/review-comment.test.ts::deciding_from_the_page:_a_`resolve:`_tag_(owner,_2026-10-15)::refusesMoveNotInTable
  Scenario: refuses a move the table does not hold, and says why
    When a decision to resolve an open comment is applied
    Then the comment stays open and the refusal says it is not a move

  @test:schemas/review-comment.test.ts::deciding_from_the_page:_a_`resolve:`_tag_(owner,_2026-10-15)::onlyRepoPeopleDecide
  Scenario: only the repository's people decide; the comment's own author may withdraw it
    When a stranger addresses the comment, and its author withdraws it
    Then the stranger is refused as one who may not decide and the comment stays open
    And the author's withdrawal is applied

  @test:schemas/review-comment.test.ts::deciding_from_the_page:_a_`resolve:`_tag_(owner,_2026-10-15)::unknownCommentDecisionRefused
  Scenario: a decision on an unknown comment is refused, not dropped
    When a decision on review-pr7-c999 is applied
    Then it is refused naming that comment

  @test:schemas/review-comment.test.ts::deciding_from_the_page:_a_`resolve:`_tag_(owner,_2026-10-15)::survivesMoveRecordsDecision
  Scenario: survives a block move/rename and records the closing Decision on resolution (423d)
    Given a comment re-anchored after its block was renamed
    When it is addressed and then resolved
    Then it targets prose:summary, is resolved, and records the move, the decision and both decisions
