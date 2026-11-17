# scripts/derive-at-publish.ts reads a writer that declines (exit 78) as skipped with its
# reason, excuses only the artefacts of skipped writers, and scripts/qa-working-copy.ts
# declines only where the QA working copy cannot be built. Each Scenario names the test that executes it.
Feature: A writer that does not apply is skipped, never failed

  @test:scripts/tests/sdlc/derive-at-publish-not-applicable.test.ts::a_writer's_exit,_read::0_ran,_78_skipped_with_its_reason,_anything_else_failed
  Scenario: Exit 0 is ran, exit 78 is skipped with its reason, anything else is failed
    Given a writer's exit code and the reason it may have handed over
    When the outcome is read
    Then exit 0 is "ran"
    And exit 78 with "no gates workflow" is skipped with that reason, trimmed
    And exit 78 with no reason is skipped with "the writer gave no reason"
    And exit 2 is failed with exit 2, ignoring any reason text
    And exit 1 is failed with exit 1, and a null exit is failed with a null exit

  @test:scripts/tests/sdlc/derive-at-publish-not-applicable.test.ts::a_writer's_exit,_read::a_real_writer_that_declines_hands_its_reason_through_the_runner
  Scenario: A real declining writer hands its reason through the runner
    Given a writer script that declines with "this root has no frobnicator"
    And a writer that exits 2 and a writer that does nothing
    When each is run through the runner
    Then the declining writer is skipped with "this root has no frobnicator"
    And the exit-2 writer is failed with exit 2
    And the empty writer ran

  @test:scripts/tests/sdlc/derive-at-publish-not-applicable.test.ts::the_artefacts_of_a_skipped_writer_are_excused,_and_only_those::an_entry_naming_a_skipped_writer_is_excused,_even_beside_another_writer
  Scenario: An artefact naming a skipped writer is excused even beside another writer
    Given artefacts "uml/overview/" by uml:overview, "docs/both/" by docs:pages and uml:overview, and "docs/subgraph/" by subgraph:jsonld
    And uml:overview was skipped
    When the plan is split into excused and judged
    Then "uml/overview/" and "docs/both/" are excused
    And only "docs/subgraph/" is judged

  @test:scripts/tests/sdlc/derive-at-publish-not-applicable.test.ts::the_artefacts_of_a_skipped_writer_are_excused,_and_only_those::nothing_skipped:_every_entry_is_judged
  Scenario: With nothing skipped every artefact is judged
    Given a plan with one artefact and no skipped writers
    When the plan is split into excused and judged
    Then nothing is excused and the whole plan is judged

  @test:scripts/tests/sdlc/derive-at-publish-not-applicable.test.ts::the_QA_working_copy's_readers_decline_only_where_it_cannot_be_built::no_gates_workflow_at_the_root:_unbuildable,_naming_it
  Scenario: A root without the gates workflow cannot build the working copy and says why
    Given an empty root directory
    When it is asked whether the QA working copy is unbuildable
    Then the reason names the gates workflow file

  @test:scripts/tests/sdlc/derive-at-publish-not-applicable.test.ts::the_QA_working_copy's_readers_decline_only_where_it_cannot_be_built::the_gates_workflow_present_(the_folio-assistant_index):_buildable,_so_the_writer_runs_and_its_failures_count
  Scenario: A root with the gates workflow can build the working copy
    # Gap: only buildability is checked; no writer is run and no failure is counted
    Given a root holding the gates workflow file
    When it is asked whether the QA working copy is unbuildable
    Then there is no reason, so it is buildable

  @test:scripts/tests/sdlc/derive-at-publish-not-applicable.test.ts::the_QA_working_copy's_readers_decline_only_where_it_cannot_be_built::a_content_index_(index.config.json_present,_bean_rn24):_buildable,_so_the_writer_runs_and_its_failures_count
  Scenario: A content index with index.config.json can build the working copy
    # Gap: only buildability is checked; no writer is run and no failure is counted
    Given a root holding only index.config.json
    When it is asked whether the QA working copy is unbuildable
    Then there is no reason, so it is buildable

  @test:scripts/tests/sdlc/derive-at-publish-not-applicable.test.ts::the_QA_working_copy's_readers_decline_only_where_it_cannot_be_built::requireCurrentWorkingCopy_exits_78_with_its_reason_in_a_root_without_the_workflow,_before_building_anything
  Scenario: requireCurrentWorkingCopy declines with exit 78 and its reason in a root without the workflow
    # Gap: that nothing is built before the decline is not checked
    Given an empty root and a file to receive the not-applicable reason
    When requireCurrentWorkingCopy is called there for "uml:overview"
    Then the process exits 78
    And stdout says "uml:overview: NOT APPLICABLE"
    And the reason file names the gates workflow
