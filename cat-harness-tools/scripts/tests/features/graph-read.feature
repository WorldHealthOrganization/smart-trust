# scripts/graph-read.ts resolves where a declared graph directory is read from: the checkout, a tip mount, or a refusal.
# The bean store, beans-fallback, issue-marks, claim-bean and workflow store readers inherit that answer.
# Each Scenario names the test that executes it.
Feature: Reading a declared graph from the checkout or its mount

  @test:scripts/tests/graph-read.test.ts::a_directory_that_never_moved::reads_from_the_checkout,_and_says_so
  Scenario: A directory that never moved reads from the checkout
    Given a git repository declaring "beans" at "beans/" with no storage, and the directory present
    When graphReadPath("beans") is called
    Then the answer is state "ok", at "<root>/beans", from "checkout", id "beans", path "beans"

  @test:scripts/tests/graph-read.test.ts::a_directory_that_never_moved::a_COMMIT-keyed_branch_directory_still_reads_from_the_checkout:_only_a_tip_mount_relocates_a_read
  Scenario: A commit-keyed branch directory still reads from the checkout
    Given a repository declaring "qa" at "test/results/" with storage keyed by "commit"
    When graphReadPath("qa") is called
    Then the answer has state "ok" and from "checkout"

  @test:scripts/tests/graph-read.test.ts::a_tip-keyed_directory,_through_the_cutover::BEFORE:_declaration_flipped,_files_still_tracked_—_the_checkout_IS_the_store
  Scenario: Before the cutover a tip-keyed directory with tracked files reads the checkout
    Given a repository declaring "beans" with tip-keyed storage
    And "beans/a.md" exists and is added to git
    When graphReadPath("beans") is called
    Then the answer is state "ok", at "<root>/beans", from "checkout", and notCutOver true

  @test:scripts/tests/graph-read.test.ts::a_tip-keyed_directory,_through_the_cutover::AFTER:_mounted_—_the_marker's_`into`,_which_need_not_be_the_declared_path
  Scenario: After the cutover a mounted directory reads the marker's into path
    Given a repository declaring "beans" with tip-keyed storage
    And a mount marker for "beans" whose into is "<root>/elsewhere"
    When graphReadPath("beans") is called
    Then the answer is state "ok", at "<root>/elsewhere", from "mount", id "beans", path "beans"

  @test:scripts/tests/graph-read.test.ts::a_tip-keyed_directory,_through_the_cutover::BETWEEN:_cut_over_and_NOT_mounted_—_refused,_never_a_plausible_empty_directory
  Scenario: Cut over and not mounted is refused with the remedy
    Given a repository declaring "beans" with tip-keyed storage, no tracked files and no mount marker
    When graphReadPath("beans") is called
    Then the state is "refused"
    And the reason contains "bun run cat state:mount" and "EMPTY graph"
    And the reason does not name the declared checkout path as a quoted answer

  @test:scripts/tests/graph-read.test.ts::a_tip-keyed_directory,_through_the_cutover::the_SAME_call_serves_before_and_after_the_cutover_—_the_migration_is_not_two_migrations
  Scenario: The same call answers before and after the cutover at the same path
    Given a repository declaring "beans" with tip-keyed storage and "beans/a.md" tracked
    When graphReadPath("beans") is read, then the file is untracked and removed and a mount is made at "<root>/beans", and it is read again
    Then both answers are state "ok"
    And both answers are at the same path
    And the first is from "checkout" and the second from "mount"

  @test:scripts/tests/graph-read.test.ts::what_it_refuses_to_guess::an_unknown_id_is_`undeclared`,_not_a_composed_path
  Scenario: An unknown id is undeclared
    Given a repository declaring no directories
    When graphReadPath("nope") is called
    Then the state is "undeclared"
    And the reason contains 'no declared directory has id "nope"'

  @test:scripts/tests/graph-read.test.ts::what_it_refuses_to_guess::a_declaration_carrying_both_`source`_and_`storage`_is_refused_with_the_resolver's_message
  Scenario: A declaration with both source and storage is refused
    Given a repository declaring "beans" with both a tip-keyed storage and a branch source
    When graphReadPath("beans") is called
    Then the state is "refused"
    And the reason contains "two answers to where its content comes from"

  @test:scripts/tests/graph-read.test.ts::what_it_refuses_to_guess::the_modern_`source`_spelling_reaches_the_same_answer_as_the_legacy_`storage`
  Scenario: The modern source spelling resolves like the legacy storage
    Given a repository declaring "beans" with a tip-keyed branch source
    And a mount marker for "beans" into "<root>/beans"
    When graphReadPath("beans") is called
    Then the answer is state "ok", at "<root>/beans", from "mount", id "beans", path "beans"

  @test:scripts/tests/graph-read.test.ts::mustReadGraph::hands_back_the_path_when_there_is_one
  Scenario: mustReadGraph returns the path when there is one
    Given a repository declaring "beans" with no storage, and the directory present
    When mustReadGraph("beans") is called
    Then it returns at "<root>/beans" from "checkout"

  @test:scripts/tests/graph-read.test.ts::mustReadGraph::throws_carrying_the_remedy_—_a_crash_beats_a_clean_run_over_an_empty_directory
  Scenario: mustReadGraph throws with the remedy when the graph is unreachable
    Given a repository declaring "beans" with tip-keyed storage and no mount
    When mustReadGraph("beans") is called
    Then it throws a message matching 'cannot read graph "beans"' followed by "state:mount"

  @test:scripts/tests/graph-read.test.ts::readBeanStore_relocates,_and_refuses::not_moved:_reads_the_checkout,_and_finds_the_bean
  Scenario: readBeanStore reads a bean from an unmoved checkout
    Given a repository declaring "beans" with no storage, holding a bean graph whose defs node has bean "fx-1"
    When readBeanStore is called
    Then the state is "read"
    And the bean ids are ["fx-1"]

  @test:scripts/tests/graph-read.test.ts::readBeanStore_relocates,_and_refuses::declaration_flipped,_files_still_tracked:_still_reads_the_checkout
  Scenario: readBeanStore still reads the checkout when the declaration is flipped but files are tracked
    Given the same bean repository declared with tip-keyed storage
    And all its files added to git
    When readBeanStore is called
    Then the state is "read"
    And the bean ids are ["fx-1"]

  @test:scripts/tests/graph-read.test.ts::readBeanStore_relocates,_and_refuses::cut_over_and_mounted:_reads_the_MOUNT,_and_`defs`_resolves_within_it
  Scenario: readBeanStore reads the mount when cut over and mounted
    Given a repository declaring "beans" with tip-keyed storage
    And a mounted directory "<root>/mounted-beans" holding a bean graph whose defs node has bean "fx-2"
    When readBeanStore is called
    Then the state is "read"
    And dir is "<root>/mounted-beans/defs"
    And the bean ids are ["fx-2"]

  @test:scripts/tests/graph-read.test.ts::readBeanStore_relocates,_and_refuses::cut_over_and_NOT_mounted:_`unreachable`,_which_is_NOT_`declared-but-absent`
  Scenario: readBeanStore reports unreachable when cut over and not mounted
    Given a repository declaring "beans" with tip-keyed storage and no mount
    When readBeanStore is called
    Then the state is "unreachable"
    And the reason contains "state:mount"

  @test:scripts/tests/graph-read.test.ts::readBeanStore_relocates,_and_refuses::readBeanFiles_THROWS_on_`unreachable`_—_five_gates_read_through_it_and_`null`_is_a_pass
  Scenario: readBeanFiles throws on an unreachable store but returns null for no store
    Given a repository declaring "beans" with tip-keyed storage and no mount
    When readBeanFiles is called
    Then it throws a message matching "cannot read the bean store" followed by "state:mount"
    And for a repository declaring no directories it returns null

  @test:scripts/tests/graph-read.test.ts::resolveBeanDefs_carries_the_third_state,_so_ten_call_sites_inherit_it::not_moved:_`dir`_resolves_in_the_checkout_and_`unreachable`_is_unset
  Scenario: resolveBeanDefs resolves in the checkout when not moved
    Given a repository declaring "beans" with no storage and a bean graph with a defs node
    When resolveBeanDefs is called
    Then it returns dir "<root>/beans/defs" and declared true, with no unreachable field
    And beanDefsDir returns "<root>/beans/defs"

  @test:scripts/tests/graph-read.test.ts::resolveBeanDefs_carries_the_third_state,_so_ten_call_sites_inherit_it::mounted:_`dir`_resolves_INSIDE_the_mount,_so_`defs`_follows_the_graph
  Scenario: resolveBeanDefs resolves inside the mount
    Given a repository declaring "beans" with tip-keyed storage
    And a mount at "<root>/mounted" holding a bean graph with a defs node
    When resolveBeanDefs is called
    Then dir is "<root>/mounted/defs"

  @test:scripts/tests/graph-read.test.ts::resolveBeanDefs_carries_the_third_state,_so_ten_call_sites_inherit_it::unreachable:_`dir`_is_null_but_`declared`_stays_true_—_the_declaration_is_CORRECT
  Scenario: resolveBeanDefs carries unreachable while declared stays true
    Given a repository declaring "beans" with tip-keyed storage and no mount
    When resolveBeanDefs is called
    Then dir is null
    And declared is true
    And unreachable contains "state:mount"

  @test:scripts/tests/graph-read.test.ts::resolveBeanDefs_carries_the_third_state,_so_ten_call_sites_inherit_it::beanDefsDir_THROWS_on_unreachable:_its_`null`_already_means_'no_store'_to_ten_callers
  Scenario: beanDefsDir throws on unreachable, keeping null for no defs node
    Given a repository declaring "beans" with tip-keyed storage and no mount
    When beanDefsDir is called
    Then it throws a message matching "cannot resolve the bean store" followed by "state:mount"
    And for a repository with no declaration it returns the default "<root>/beans/defs"
    And for a bean graph that declares only a "bean-notes" node it returns null

  @test:scripts/tests/graph-read.test.ts::resolveBeanDefs_carries_the_third_state,_so_ten_call_sites_inherit_it::readBeans_inherits_it_rather_than_reporting_an_empty_roadmap
  Scenario: readBeans throws on an unreachable store rather than returning an empty roadmap
    Given a repository with an unmoved bean graph holding bean "fx-1"
    When readBeans is called
    Then the bean ids are ["fx-1"]
    And for a repository declaring tip-keyed "beans" with no mount, readBeans throws "cannot resolve the bean store"

  @test:scripts/tests/graph-read.test.ts::beans-fallback:_the_CLI-absent_reader_relocates,_and_refuses::not_moved:_the_`.beans.yml`_path,_unchanged
  Scenario: beans-fallback keeps the .beans.yml path when not moved
    Given a repository declaring "beans" with no storage and a ".beans.yml" with path "beans/defs"
    When readStoreConfig and fallbackStoreDir are called
    Then the config dir is "beans/defs"
    And the store dir is at "<root>/beans/defs"

  @test:scripts/tests/graph-read.test.ts::beans-fallback:_the_CLI-absent_reader_relocates,_and_refuses::mounted:_the_part_inside_the_graph_is_REBASED_onto_the_mount,_the_rest_kept
  Scenario: beans-fallback rebases the in-graph part of the path onto the mount
    Given the fallback repository declared with tip-keyed storage
    And a mount for "beans" into "<root>/elsewhere"
    When fallbackStoreDir is called
    Then the store dir is at "<root>/elsewhere/defs"

  @test:scripts/tests/graph-read.test.ts::beans-fallback:_the_CLI-absent_reader_relocates,_and_refuses::unreachable:_refused,_and_`listBeans`_THROWS_rather_than_returning_[]
  Scenario: beans-fallback refuses an unreachable store and listBeans throws
    Given the fallback repository declared with tip-keyed storage and no mount
    When fallbackStoreDir is called
    Then the answer carries "refused"
    And listBeans throws "cannot read the bean store"

  @test:scripts/tests/graph-read.test.ts::beans-fallback:_the_CLI-absent_reader_relocates,_and_refuses::a_`.beans.yml`_path_OUTSIDE_the_declared_graph_is_left_alone,_not_invented_onto_it
  Scenario: A .beans.yml path outside the declared graph is left alone
    Given a repository declaring tip-keyed "beans" and a ".beans.yml" with path "somewhere/else"
    When fallbackStoreDir is called
    Then the store dir is at "<root>/somewhere/else"

  @test:scripts/tests/graph-read.test.ts::todos,_issue-marks_and_the_claim_writer_resolve_by_declared_ID::issue-marks:_`seenPath`_lands_in_the_mount,_and_REFUSES_when_the_graph_is_unreachable
  Scenario: issue-marks seenPath lands in the mount and refuses when unreachable
    Given a repository declaring "issue-marks" with no storage
    When seenPath is called for owner "o", repo "r", issue 7
    Then it is "<root>/issue-marks/o-r-7.json"
    And with tip-keyed storage mounted into "<root>/im-mount" it is "<root>/im-mount/o-r-7.json"
    And with tip-keyed storage and no mount it throws "cannot resolve the issue-marks graph"

  @test:scripts/tests/graph-read.test.ts::todos,_issue-marks_and_the_claim_writer_resolve_by_declared_ID::todos:_`TODO_ROOT`_still_resolves_to_the_checkout's_real_todos_directory_(inert_today)
  Scenario: todos TODO_ROOT still resolves to the checkout's todos directory
    # Skipped: when the checkout stands alone, with no todo graph mounted from its state branch
    Given this checkout composed with its todo graph
    When TODO_ROOT is called
    Then the path ends in "/todos"

  @test:scripts/tests/graph-read.test.ts::todos,_issue-marks_and_the_claim_writer_resolve_by_declared_ID::claim-bean_DISPATCHES_to_the_branch_store_once_the_store_is_mounted_—_it_no_longer_pushes_to_main
  Scenario: claim-bean dispatches to the branch store once the store is mounted
    Given a repository declaring tip-keyed "beans" with a mount and no remote
    When claimOnDefaultBranch is called for "fx-1" on "some-branch"
    Then the state is "unknown"
    And the reason does not contain "where no reader looks"
    And the reason names "cat/cat-harness/beans", the branch store, or tip-keyed

  @test:scripts/tests/graph-read.test.ts::todos,_issue-marks_and_the_claim_writer_resolve_by_declared_ID::claim-bean_is_UNCHANGED_while_the_checkout_still_tracks_the_files_—_`notCutOver`_is_the_discriminator
  Scenario: claim-bean is unchanged while the checkout still tracks the files
    Given a repository declaring tip-keyed "beans" with "beans/defs/a.md" tracked in git
    When claimOnDefaultBranch is called for "fx-1" on "some-branch"
    Then the reason does not contain "where no reader looks"
    And the reason does not contain "not mounted here"

  @test:scripts/tests/graph-read.test.ts::resolveBeanGraphNode_and_the_workflow_instance_store::every_node_of_the_graph_moves,_not_only_`defs`
  Scenario: Every node of the bean graph relocates, not only defs
    Given an unmoved bean graph declaring "defs" and "workflows"
    When resolveBeanGraphNode is asked for "workflow-state"
    Then dir is "<root>/beans/workflows"
    And for a tip-keyed graph mounted into "<root>/mount", dir is "<root>/mount/workflows"

  @test:scripts/tests/graph-read.test.ts::resolveBeanGraphNode_and_the_workflow_instance_store::unreachable_is_carried,_not_turned_into_a_path_that_happens_not_to_exist
  Scenario: resolveBeanGraphNode carries unreachable rather than a path
    Given a repository declaring tip-keyed "beans" with no mount
    When resolveBeanGraphNode is asked for "workflow-state"
    Then dir is null
    And declared is true
    And unreachable contains "state:mount"

  @test:scripts/tests/graph-read.test.ts::resolveBeanGraphNode_and_the_workflow_instance_store::`WORKFLOW_DIR`_is_UNCHANGED_—_the_gate_that_compares_it_to_the_declaration_still_has_its_subject
  Scenario: WORKFLOW_DIR is unchanged
    When WORKFLOW_DIR is read from the workflow store
    Then it is "beans/workflows"

  @test:scripts/tests/graph-read.test.ts::resolveBeanGraphNode_and_the_workflow_instance_store::`workflowDir`_relocates,_memoises,_and_throws_rather_than_listing_an_absent_directory
  Scenario: workflowDir relocates, memoises and throws when unreachable
    # Gap: memoisation is not observed directly, only that a second call returns the same path
    Given the workflow directory cache is cleared and an unmoved bean graph with a workflows node
    When workflowDir is called twice
    Then both calls return "<root>/beans/workflows"
    And for a tip-keyed graph with no mount, after clearing the cache, it throws "cannot resolve the workflow instance directory"

  @test:scripts/tests/graph-read.test.ts::resolveBeanGraphNode_and_the_workflow_instance_store::`workflowStateAbsent`:_only_a_mount's_recorded_ABSENCE_is_not-applicable;_unreachable_is_not
  Scenario: workflowStateAbsent is set only by a recorded absence, not by unreachable
    Given an unmoved bean graph
    Then workflowStateAbsent is undefined
    And for a tip-keyed graph with no mount it is also undefined
    And once an absence is recorded for "beans" it contains "carries no cat/cat-harness/* branch"

  @test:scripts/tests/graph-read.test.ts::a_branch_FAMILY_(bean_lehh)::is_refused,_never_read_as_the_empty_declared_path
  Scenario: A branch family directory is refused, not read as the empty declared path
    Given a repository declaring "ig-ast" with storage keyed by "family" under a branch prefix
    When graphReadPath("ig-ast") is called
    Then the state is "refused"
    And the answer mentions "FAMILY"

  @test:scripts/tests/graph-read.test.ts::enclosingCheckout_—_markers_are_looked_up_in_the_checkout_that_holds_the_instance::an_instance_mounted_in_an_index_resolves_to_the_index_root,_where_the_markers_are
  Scenario: An instance inside an index resolves to the index root
    Given a directory with a ".git" and a "cat-harness/test" subdirectory
    When enclosingCheckout is called on "<top>/cat-harness"
    Then it returns "<top>"

  @test:scripts/tests/graph-read.test.ts::enclosingCheckout_—_markers_are_looked_up_in_the_checkout_that_holds_the_instance::a_checkout_root_is_its_own_answer,_so_a_caller_that_already_passes_it_is_unchanged
  Scenario: A checkout root is its own enclosing checkout
    Given a directory with a ".git"
    When enclosingCheckout is called on that directory
    Then it returns the same directory

  @test:scripts/tests/graph-read.test.ts::enclosingCheckout_—_markers_are_looked_up_in_the_checkout_that_holds_the_instance::with_no_.git_above,_the_root_itself,_as_before
  Scenario: With no .git above, the root itself is returned
    Given a fresh temporary directory with no ".git" above it
    When enclosingCheckout is called on it
    Then it returns the same directory
