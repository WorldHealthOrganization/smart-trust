Feature: the agent's record of a change set in the review sheet

  @test:tools/review-sheet-sync/agent-record.test.ts::agent-record_(owner,_2026-10-31,_option_C)::numbersGrouped
  Scenario: numbers are grouped as the sheet reads them
    When comment numbers are labelled
    Then one is "No. 136" and many are grouped into runs in order

  @test:tools/review-sheet-sync/agent-record.test.ts::agent-record_(owner,_2026-10-31,_option_C)::numbersFromSheet
  Scenario: the change set's numbers come from the sheet, so another change set's comments cannot slip in
    When dispositions are written for a change set with a rest item
    Then there is no problem and the rest are the change set's own numbers

  @test:tools/review-sheet-sync/agent-record.test.ts::agent-record_(owner,_2026-10-31,_option_C)::historyKeptAppended
  Scenario: the decision history is kept, in order, and new decisions are appended
    When dispositions are written with a previous history and a new decision
    Then the history is kept in order with the new decision appended, then the overall and the items

  @test:tools/review-sheet-sync/agent-record.test.ts::agent-record_(owner,_2026-10-31,_option_C)::blueWordUsed
  Scenario: the people's Blue word is used, and a different word is refused
    When dispositions are written with the people's Blue dispositions
    Then the Blue word is used
    And a different word is a problem naming both

  @test:tools/review-sheet-sync/agent-record.test.ts::agent-record_(owner,_2026-10-31,_option_C)::numberOutsideOrMissing
  Scenario: a number outside the change set, or one left out, is a problem
    When dispositions name a number outside the change set, or leave some out
    Then each is a problem

  @test:tools/review-sheet-sync/agent-record.test.ts::agent-record_(owner,_2026-10-31,_option_C)::pushTimeAndSha
  Scenario: push takes the time from the clock and the full sha
    When push and done records are made
    Then push gives the full sha, the expected staging time and completion time from the clock
    And a short sha is refused
    And done gives the completion time and idle step

  @test:tools/review-sheet-sync/agent-record.test.ts::agent-record_(owner,_2026-10-31,_option_C)::briefSameLines
  Scenario: the PR's review brief carries the same lines, without the decision history
    When the review brief is made
    Then it carries the overall, the items and where to look, without the history

  @test:tools/review-sheet-sync/agent-record.test.ts::agent-record_(owner,_2026-10-31,_option_C)::pcsLinksDashboard
  Scenario: --pcs links each comment to its dashboard row by its Comment ref, a run spelled out
    When numbers are linked to the dashboard by their Comment ref
    Then each number in a run is linked
    And without refs the label is unchanged
    And a brief without a Comment ref column throws

  @test:tools/review-sheet-sync/agent-record.test.ts::review-sheet_QA_pass_writes_editing-hci-validation_instances_that_satisfy_check:corpus-gate_(#448)::qaPassWritesInstances
  Scenario: qaPass writes editing--<block>.json per changed block and checkCorpusGate allows the change
    Given a change set touching one block with no instance
    When the QA pass runs
    Then the gate refuses the block before
    And the pass writes the cells and one editing instance for the block, through the commit with the change set and QA note
    And the gate allows it after

  @test:tools/review-sheet-sync/agent-record.test.ts::review-sheet_QA_pass_writes_editing-hci-validation_instances_that_satisfy_check:corpus-gate_(#448)::discoversBlocksFromGit
  Scenario: discovers changed blocks from git diff (including DAK blocks and .md siblings) and supports --blocks
    When the QA pass runs over a git diff and with --blocks
    Then the changed DAK block and the .md sibling's block are found
    And the QA gate cell names the head commit and an instance is written for each

  @test:tools/review-sheet-sync/agent-record.test.ts::review-sheet_QA_pass_writes_editing-hci-validation_instances_that_satisfy_check:corpus-gate_(#448)::refusesBadQaGate
  Scenario: refuses a failed, stale, or commit-less QA gate and writes no workflow instances
    When the QA pass runs with a failed, commit-less and stale QA gate
    Then each is refused and no instance is written

  @test:tools/review-sheet-sync/agent-record.test.ts::review-sheet_QA_pass_writes_editing-hci-validation_instances_that_satisfy_check:corpus-gate_(#448)::blockLabelForManifestsOnly
  Scenario: blockLabelFor distinguishes block manifests from chapters, sections, and helpers
    When labels are read from a block manifest, a chapter and a helper
    Then only the block manifest gives its label

  @test:tools/review-sheet-sync/agent-record.test.ts::review-sheet_QA_pass_writes_editing-hci-validation_instances_that_satisfy_check:corpus-gate_(#448)::instanceRecordsDecision
  Scenario: editingWorkflowInstance records the change set, QA pass, and editor decision through Task_Commit
    When an editing instance is made for a block
    Then its id is editing--prose-annex-1, it is at Task_Commit with it in history, and it carries its schema
