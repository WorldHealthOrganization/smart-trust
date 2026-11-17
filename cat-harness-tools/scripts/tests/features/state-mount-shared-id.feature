# One state-graph id declared by two instances, each kept on its own branch in
# its own repository, and a mounted layer's work plan kept apart from the
# checkout's. Each Scenario names the test that executes it.
Feature: Tip-keyed state graphs are located per instance

  Background:
    Given an index checkout with instances alpha and beta
    And each declares a tip-keyed "health" directory on the branch cat/<instance>/health of its own repository

  @test:scripts/tests/state-mount-shared-id.test.ts::two_instances_declaring_the_same_state-graph_id::tipLocations_lists_BOTH,_each_keyed_by_its_instance_and_read_from_its_own_repository
  Scenario: Both declarations are listed, each keyed by its instance
    When the tip locations are read
    Then there are exactly two, alpha.health and beta.health
    And each names its instance, its own repository and its instance-relative path

  @test:scripts/tests/state-mount-shared-id.test.ts::two_instances_declaring_the_same_state-graph_id::resolveTipLocation_refuses_the_shared_id_as_ambiguous_and_takes_a_key
  Scenario: The bare id is ambiguous, a key is not
    When "health" is resolved
    Then it is refused, saying 2 declared directories have id health
    And "beta.health" resolves to beta's path and repository

  @test:scripts/tests/state-mount-shared-id.test.ts::two_instances_declaring_the_same_state-graph_id::state:mount_mounts_both,_each_from_its_own_repository,_with_a_marker_apiece
  Scenario: state:mount mounts both, each from its own repository
    When state is mounted
    Then alpha.health and beta.health are both mounted
    And each instance's report came from its own repository
    And each has its own keyed marker
    And both directories are listed as mounted, and each reads as mounted where it was put

  @test:scripts/tests/state-mount-shared-id.test.ts::two_instances_declaring_the_same_state-graph_id::`--id_health`_selects_every_graph_with_that_id;_a_key_selects_one
  Scenario: Selecting by id takes every graph with it; a key takes one
    When state is mounted with --id health
    Then both alpha.health and beta.health are mounted
    When state is mounted with --id beta.health
    Then only beta.health is mounted

  @test:scripts/tests/state-mount-shared-id.test.ts::two_instances_declaring_the_same_state-graph_id::a_push_goes_to_the_instance's_own_repository,_at_its_instance-relative_path
  Scenario: A push goes to the edited instance's own repository
    Given state is mounted
    When beta's report is edited and state is pushed
    Then beta.health is pushed and alpha.health is unchanged
    And beta's branch holds the edit, and alpha's branch still holds alpha's report

  @test:scripts/tests/state-mount-shared-id.test.ts::a_marker_written_before_locations_were_keyed::with_no_edits,_the_re-mount_replaces_it_with_the_keyed_marker_—_never_leaves_both
  Scenario: An unedited legacy marker is replaced by the keyed one
    Given an unkeyed "health" marker for alpha's directory, as the old code wrote it
    When state is mounted
    Then the markers are exactly alpha.health and beta.health
    And alpha's report is the one from alpha's repository

  @test:scripts/tests/state-mount-shared-id.test.ts::a_marker_written_before_locations_were_keyed::with_edits,_it_is_found,_left_untouched,_and_its_edits_push_to_where_they_were_read_from
  Scenario: An edited legacy mount is kept, and its edits push back where they came from
    Given an unkeyed "health" marker for alpha's directory, whose file has been edited
    When state is mounted
    Then alpha.health is stale and the legacy marker is still there
    When alpha.health is pushed
    Then the edit lands on the checkout's origin, at alpha's path
    And alpha's own repository is unchanged

  @test:scripts/tests/state-mount-shared-id.test.ts::a_mounted_layer's_own_work_plan_is_never_the_checkout's::the_upstream's_beans_mount_as_ITS_graph,_and_the_checkout-level_`beans`_stays_unmounted
  Scenario: The upstream's beans mount as its own graph
    Given a platform layer declaring repository-scoped beans on a branch the origin lacks
    And a mounted upstream layer keeping its own beans on its own branch
    When state is mounted
    Then up.beans is mounted and plat.beans is not
    And the upstream's work item file is present under up/beans
    And up's beans read as mounted, and the checkout-level beans as unmounted

  @test:scripts/tests/state-mount-shared-id.test.ts::a_mounted_layer's_own_work_plan_is_never_the_checkout's::the_checkout's_bean_store_resolves_to_nothing,_not_to_the_upstream's_beans
  Scenario: The checkout's bean store does not resolve to the upstream's
    Given the same platform and upstream layers
    When state is mounted and the beans graph's read path is resolved
    Then it is refused
