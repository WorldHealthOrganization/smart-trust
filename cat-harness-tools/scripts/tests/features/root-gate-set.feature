# A root is measured against its OWN gate set: a harness root against its
# workflow, a content root against the gates its PR checks run.
# Each Scenario names the test that executes it.
Feature: A root's own gate set

  @test:scripts/tests/root-gate-set.test.ts::which_gate_set_a_root_is_measured_against::a_root_with_the_harness's_gates_workflow_is_a_harness;_one_without_is_a_content_root
  Scenario: The gates workflow decides harness or content root
    Given a fixture root carrying the harness gates workflow and one without it
    Then the first is profiled "harness" and the second "content"

  @test:scripts/tests/root-gate-set.test.ts::which_gate_set_a_root_is_measured_against::a_content_root's_gates_are_the_ones_its_PR_checks_run,_derived_by_run-gates.py
  Scenario: A content root's gates are derived from its PR checks
    Given a content root "doc" that needs a layer "lib" with gate scripts, a build script and checkout scripts
    When its gate set is derived
    Then own is ["doc"], harness is ["doc", "lib"] and the runner is "bun run cat"
    And the gates include the graph audit, doc's and lib's declared gates, lib's checkout script and the shared cat-harness-tools checks
    And no gate is a build script
    And lib:check:a runs "bun run cat check:a"

  @test:scripts/tests/root-gate-set.test.ts::which_gate_set_a_root_is_measured_against::loadGates_reads_that_set_for_a_content_root,_under_the_shared_PR_checks
  Scenario: loadGates reads the derived set under the shared PR checks job
    When the gates of the content root are loaded
    Then every gate's job is the layer PR checks
    And the commands include "bun run cat foo:check" but not the harness-only gate

  @test:scripts/tests/root-gate-set.test.ts::which_gate_set_a_root_is_measured_against::a_gate_CI_runs_with_an_input_this_side_lacks_is_unresolved_here,_and_still_in_what_CI_runs
  Scenario: A gate needing a CI-only input is unresolved locally but still run by CI
    Given GATE_DIFF_BASE is unset
    Then the unresolved gates are exactly lib:check:corpus-gate
    And the locally loaded gates omit it
    And the gates CI runs include it

  @test:scripts/tests/root-gate-set.test.ts::which_gate_set_a_root_is_measured_against::a_harness_root_is_still_measured_against_its_own_workflow,_not_the_derived_set
  Scenario: A harness root is measured against its own workflow
    When the gates of the harness root are loaded
    Then the only command is "bun run cat check:harness-only" in job "typescript"

  @test:scripts/tests/root-gate-set.test.ts::which_gate_set_a_root_is_measured_against::a_root_with_no_instance_has_no_gate_set:_refused,_never_an_empty_pass
  Scenario: A root with no instance is refused
    Given an empty directory
    Then deriving its gate set throws GateSetUndetermined
    And loading its gates throws an error saying "NOT a pass"

  @test:scripts/tests/root-gate-set.test.ts::gates_whose_subject_this_root's_git_does_not_hold::in_a_root_that_ignores_the_mounts,_bootstrap-tools'_committed-tree_gates_are_skipped_with_their_reason
  Scenario: Committed-tree gates are skipped where git ignores the mounts
    Given an index root whose .gitignore ignores the bootstrap mounts
    When its gate set is derived
    Then bootstrap-tools book:check and check:standalone are skipped as "untracked-corpus", citing cat-harness-tools#1701
    And bootstrap-tools check:closure is still a gate

  @test:scripts/tests/root-gate-set.test.ts::gates_whose_subject_this_root's_git_does_not_hold::in_a_root_whose_git_tracks_bootstrap,_they_run_exactly_as_before
  Scenario: Committed-tree gates run where git tracks bootstrap
    Given an index root whose git tracks the mounts
    When its gate set is derived
    Then bootstrap-tools book:check and check:standalone are gates and book:check is not skipped

  @test:scripts/tests/root-gate-set.test.ts::gates_whose_subject_this_root's_git_does_not_hold::merge:request:check_needs_a_request_file,_so_it_is_skipped_as_needs-input
  Scenario: merge:request:check is skipped as needing input
    When the gate set of the index root is derived
    Then cat-harness-tools merge:request:check is skipped as "needs-input"

  @test:scripts/tests/root-gate-set.test.ts::qa:refresh_in_a_content_root::an_undeclared_script_and_unmounted_state_are_not_applicable,_each_with_its_reason
  Scenario: An undeclared script and unmounted state make writers not applicable
    Given four QA writers, one whose script no instance declares and one that reads state
    When the not-applicable writers are found for a content root without state mounted
    Then they are p2:refusals, "declared by no instance", and docs:pages, naming "state branches"

  @test:scripts/tests/root-gate-set.test.ts::qa:refresh_in_a_content_root::with_state_mounted,_a_state_reader_runs
  Scenario: With state mounted the state reader applies
    When the not-applicable writers are found for a content root with state mounted
    Then only p2:refusals is not applicable

  @test:scripts/tests/root-gate-set.test.ts::qa:refresh_in_a_content_root::in_a_harness_root_nothing_is_excused:_a_missing_script_there_is_a_broken_declaration
  Scenario: A harness root excuses no writer
    When the not-applicable writers are found for a harness root
    Then the list is empty

  @test:scripts/tests/root-gate-set.test.ts::qa:refresh_in_a_content_root::a_not-applicable_writer_is_neither_empty_nor_failed;_a_real_failure_still_fails
  Scenario: Not applicable is neither empty nor failed, and a real failure fails
    Given an inventory holding the two applicable writers' outputs
    When the refresh is assessed with both applicable writers exiting 0
    Then it is complete, nothing is empty and the two not-applicable writers are listed
    And when check:declared exits 1 the refresh is incomplete with check:declared failed

  @test:scripts/tests/root-gate-set.test.ts::qa:refresh_in_a_content_root::the_writers_that_read_state_graphs_say_so
  Scenario: The writers that read state are declared so
    When the registered QA writers that read state are listed
    Then they are check:harness-state, check:unlinked-beans, docs:pages and skill:register

  @test:scripts/tests/root-gate-set.test.ts::qa:refresh_in_a_content_root::a_layer's_own_`scripts`_entry_(not_in_`checkoutScripts`)_is_resolved_in_that_layer's_directory_by_`run-script.ts`
  Scenario: A layer's own script is resolved in that layer's directory
    When foo:check is resolved in the content root
    Then it runs "bun foo.ts" in lib with manifest lib/package.json
    And the checkout script check:b and an unknown script are not resolved
