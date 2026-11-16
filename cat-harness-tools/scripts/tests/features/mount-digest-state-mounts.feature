# A remote mount's integrity digest skips the directories a state mount laid
# down inside it, and nothing else (folio-assistant#2529). Each Scenario names
# the test that executes it.
Feature: The mount digest skips state-mounted directories

  @test:scripts/tests/mount-digest-state-mounts.test.ts::withoutStateMounts::drops_only_the_files_under_a_state-mounted_directory
  Scenario: Only the files under a state-mounted directory are dropped
    When a file under the state mount, a file beside it and a top-level file are filtered
    Then the top-level file and the file beside the mount remain

  @test:scripts/tests/mount-digest-state-mounts.test.ts::withoutStateMounts::a_sibling_whose_name_only_STARTS_with_the_mount's_is_kept
  Scenario: A sibling whose name only starts with the mount's is kept
    When a file under results-old is filtered against a mount at results
    Then it remains

  @test:scripts/tests/mount-digest-state-mounts.test.ts::withoutStateMounts::no_state_mounts_skips_nothing
  Scenario: No state mounts skips nothing
    When files are filtered with no state mounts
    Then all remain

  @test:scripts/tests/mount-digest-state-mounts.test.ts::stateMountedDirs::no_marker_directory_is_no_mounts,_not_an_error
  Scenario: No marker directory means no mounts
    Then a repository with no branch-mount markers has no state-mounted directories

  @test:scripts/tests/mount-digest-state-mounts.test.ts::stateMountedDirs::reads_`into`_from_each_branch-mount/v1_marker,_and_ignores_anything_else
  Scenario: into is read from each branch-mount/v1 marker, and anything else ignored
    Given a branch-mount/v1 marker, a marker of another schema and a marker that is not JSON
    Then the state-mounted directories are only the first marker's into

  @test:scripts/tests/mount-digest-state-mounts.test.ts::stateMountedDirs::markers_keyed_`<instance>.<id>`_—_one_id_declared_by_several_instances_—_are_read_too
  Scenario: Markers keyed <instance>.<id> are read too
    Given a second marker keyed inst2.health for the same id
    Then both markers' directories are state-mounted

  @test:scripts/tests/mount-digest-state-mounts.test.ts::digestOf::a_state_mount's_bytes_do_not_move_the_instance's_digest
  Scenario: A state mount's bytes do not move the instance's digest
    When a file under the state mount changes
    Then the instance's digest skipping that mount is unchanged

  @test:scripts/tests/mount-digest-state-mounts.test.ts::digestOf::an_edit_OUTSIDE_the_state_mount_still_does
  Scenario: An edit outside the state mount moves the digest
    When a file outside the state mount changes
    Then the tree digest changes
