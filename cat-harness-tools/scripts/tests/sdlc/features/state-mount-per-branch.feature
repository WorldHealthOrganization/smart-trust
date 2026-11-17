# scripts/state-mount.ts and scripts/state-push.ts mount and push the state subgraphs with one
# branch per declared graph, against real file:// git remotes; a failing graph never lets the rest read clean.
# Each Scenario names the test that executes it.
Feature: The state mount and push work per graph branch

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::a_branch_per_graph_(D4_option_b)::two_declared_tip_branches_both_mount_—_the_>1_refusal_is_gone
  Scenario: Two declared tip branches both mount
    Given a checkout declaring "beans-defs" on "cat/cat-harness/beans" and "todos" on "cat/cat-harness/todos", both seeded on the remote
    When the state is mounted
    Then the aggregate state is "mounted" and the report carries no stop-sign marker
    And both graphs are listed and each is "mounted"
    And each graph's branch is the one its own declaration names

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::a_branch_per_graph_(D4_option_b)::each_graph_lands_at_its_own_declared_path,_not_under_a_shared_state/
  Scenario: Each graph lands at its own declared path
    Given the two-graph checkout with both branches seeded
    When the state is mounted
    Then "beans/defs/a.md" reads "A" and "todos/t1.md" reads "T"
    And no "beans/defs/manifest.json" is dropped into the checkout
    And there is no "state" directory

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::a_branch_per_graph_(D4_option_b)::the_declared_path_is_read_from_the_declaration,_so_two_graphs_never_collide
  Scenario: Each mounted graph has a distinct declared path
    Given the two-graph checkout with both branches seeded
    When the state is mounted
    Then the graphs' paths are all distinct
    And they are "beans/defs" and "todos"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::one_graph_failing_never_lets_the_others_read_clean_(bean_1xhc)::the_aggregate_is_`partial`,_names_the_failure,_and_keeps_the_good_mount
  Scenario: A missing branch makes the mount partial but keeps the good graph
    Given the two-graph checkout whose todos branch was never pushed
    When the state is mounted
    Then the aggregate state is "partial"
    And "beans-defs" is "mounted" and "todos" is not
    And "beans/defs/a.md" still reads "A"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::one_graph_failing_never_lets_the_others_read_clean_(bean_1xhc)::the_report_shouts,_names_the_graph_that_failed,_and_says_what_not_to_believe
  Scenario: The partial-mount report warns and names both graphs
    Given the two-graph checkout whose todos branch was never pushed
    When the mount report is rendered
    Then it carries the stop-sign marker
    And it names "todos" and says "do not trust an empty work-plan"
    And it also names "beans-defs"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::one_graph_failing_never_lets_the_others_read_clean_(bean_1xhc)::a_corrupt_branch_is_a_failure_for_THAT_graph_only
  Scenario: A corrupt branch fails only its own graph
    Given the two-graph checkout whose todos branch has a manifest of the wrong schema
    When the state is mounted
    Then the aggregate state is "partial"
    And "beans-defs" is "mounted" and "todos" is "corrupt"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::one_graph_failing_never_lets_the_others_read_clean_(bean_1xhc)::every_graph_failing_is_`failed`,_not_`partial`
  Scenario: Every graph failing makes the mount failed
    Given the two-graph checkout with neither branch pushed
    When the state is mounted
    Then the aggregate state is "failed"
    And no graph is "mounted"
    And the report carries the stop-sign marker

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::state:push_splices_back_PER_BRANCH,_not_to_one::each_graph's_edit_lands_on_its_OWN_branch,_and_neither_reverts_the_other
  Scenario: Each graph's edit is pushed to its own branch only
    Given the two-graph state mounted, with "beans/defs/a.md" and "todos/t1.md" both edited
    When the state is pushed with message "per-branch splice"
    Then the push state is "pushed" with both graphs "pushed" on their own declared branches
    And the beans branch holds "A edited" and the todos branch holds "T edited"
    And neither branch holds the other graph's file

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::state:push_splices_back_PER_BRANCH,_not_to_one::a_new_file_is_created_on_its_own_graph's_branch
  Scenario: A new file is pushed to its own graph's branch
    Given the two-graph state mounted and a new "todos/t2.md"
    When the state is pushed
    Then the push state is "pushed"
    And the todos branch holds "todos/t2.md" reading "T2"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::state:push_splices_back_PER_BRANCH,_not_to_one::--dry-run_previews_every_graph_and_sends_nothing
  Scenario: A dry-run push previews every graph and sends nothing
    Given the two-graph state mounted with "beans/defs/a.md" edited
    When the state is pushed as a dry run
    Then the push state is "would-push" listing 2 graphs
    And the beans branch on the remote still reads "A"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::state:push_splices_back_PER_BRANCH,_not_to_one::no_graph_with_changes_is_`nothing`,_not_a_failure
  Scenario: A push with no changes is nothing
    Given the two-graph state mounted and unedited
    When the state is pushed
    Then the push state is "nothing"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::state:push_splices_back_PER_BRANCH,_not_to_one::nothing_mounted_is_`no-mount`,_the_same_answer_the_single_mount_gives
  Scenario: A push with nothing mounted is no-mount
    Given the two-graph checkout that was never mounted
    When the state is pushed
    Then the push state is "no-mount"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::state:push_splices_back_PER_BRANCH,_not_to_one::one_graph_failing_to_push_leaves_the_other's_push_standing_(bean_1xhc)
  Scenario: A conflict on one graph leaves the other graph's push standing
    Given the two-graph state mounted with both files edited
    And a sibling has pushed its own edit of "todos/t1.md" to the todos branch
    When the state is pushed
    Then the push state is "partial", with "beans-defs" "pushed" and "todos" "conflict"
    And the beans branch holds "A edited" and the todos branch keeps the sibling's text
    And the local "todos/t1.md" still reads "T edited"
    And the push report carries the stop-sign marker, names "todos" and "beans-defs", and says "Nothing was discarded"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::state:push_splices_back_PER_BRANCH,_not_to_one::a_partial_push_exits_non-zero_through_the_CLI
  Scenario: The push CLI exits non-zero on a partial push
    Given the two-graph state mounted with both files edited and a sibling's conflicting todos push
    When the state-push CLI is run in the checkout
    Then it exits non-zero
    And its output carries the stop-sign marker

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::state:push_splices_back_PER_BRANCH,_not_to_one::binary,_executable_and_symlink_survive_the_per-branch_round_trip
  Scenario: Binary, executable and symlink files survive the per-branch push
    Given the two-graph state mounted, with a binary "todos/blob.bin", an executable "todos/run.sh" and a symlink "todos/link.md" to "t1.md"
    When the state is pushed
    Then the push state is "pushed"
    And the todos branch holds the exact binary bytes
    And "todos/run.sh" has mode 100755 and "todos/link.md" mode 120000 pointing at "t1.md"

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::the_exit_code_carries_the_finding::a_partial_mount_exits_non-zero
  Scenario: The mount CLI exits non-zero on a partial mount
    Given the two-graph checkout whose todos branch was never pushed
    When the state-mount CLI is run
    Then it exits non-zero
    And its output carries the stop-sign marker

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::the_exit_code_carries_the_finding::every_graph_mounted_exits_0
  Scenario: The mount CLI exits 0 when every graph mounts
    Given the two-graph checkout with both branches seeded
    When the state-mount CLI is run
    Then it exits 0
    And its output carries no stop-sign marker

  @test:scripts/tests/sdlc/state-mount-per-branch.test.ts::the_exit_code_carries_the_finding::nothing_declared_stays_quiet_and_exits_0_—_failing_here_is_the_crying_wolf
  Scenario: The mount CLI stays quiet when nothing is declared
    Given a checkout declaring no state directories
    When the state-mount CLI is run
    Then it exits 0
    And its output carries no stop-sign marker and says "Not enabled"
