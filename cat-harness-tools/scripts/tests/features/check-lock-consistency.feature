# scripts/check-lock-consistency.ts compares each mounted layer's own index.lock.json with the
# composition's index lock, so every lock pins the same commit of a shared lower layer.
# Each Scenario names the test that executes it.
Feature: Locks agree on shared layers

  @test:scripts/tests/check-lock-consistency.test.ts::aligned:_the_layer's_own_lock_pins_the_shared_layer_at_the_index's_commit
  Scenario: A layer's lock pinning the shared layer at the index's commit is aligned
    Given an index lock pinning bootstrap at "b1" and cat-harness at "c1"
    And cat-harness's own lock on disk pinning bootstrap at "b1"
    When the lock skews are read
    Then there are no skews and nothing undetermined
    And 1 pin was compared

  @test:scripts/tests/check-lock-consistency.test.ts::skewed:_the_measured_case,_bootstrap_at_one_commit_in_the_index_and_another_in_cat-harness's_lock
  Scenario: Bootstrap pinned at different commits by the index and by cat-harness is a skew
    Given an index lock pinning bootstrap at "c90ef456"
    And cat-harness's own lock pinning bootstrap at "a83ae82d"
    When the lock skews are read
    Then the one skew names bootstrap, index "c90ef456", layer cat-harness and layer pin "a83ae82d"

  @test:scripts/tests/check-lock-consistency.test.ts::a_lock_not_on_disk_is_read_at_the_pinned_commit;_a_layer_pinning_what_the_index_does_not_mount_is_not_compared
  Scenario: A lock not on disk is fetched at its pinned commit, and unmounted pins are not compared
    Given an index lock pinning bootstrap at "b1" and upper-layer at "s1", with no layer lock on disk
    And a fetcher returning a lock that pins bootstrap at "b2" and "not-mounted-here" at "x"
    When the lock skews are read
    Then the fetcher was asked for "o/upper-layer@s1"
    And the only skew is bootstrap, index "b1", layer upper-layer, layer pin "b2"
    And 1 pin was compared

  @test:scripts/tests/check-lock-consistency.test.ts::a_lock_that_cannot_be_read_is_could-not-determine,_never_a_pass
  Scenario: A lock that cannot be read is undetermined, never a pass
    Given an index lock pinning bootstrap and upper-layer, with no layer lock on disk
    And a fetcher that always throws
    When the lock skews are read
    Then the undetermined list contains "upper-layer: cannot fetch o/upper-layer@s1"
    And there are 2 undetermined entries and no skews

  @test:scripts/tests/check-lock-consistency.test.ts::skews_are_a_report_by_default_(exit_0),_and_exit_1_only_when_--gate_is_asked
  Scenario: Skews are reported with exit 0 by default and exit 1 only with --gate
    Given an index lock pinning bootstrap at "c90ef456"
    And cat-harness's own lock pinning bootstrap at "a83ae82d"
    When the exit code is computed for the reading
    Then it is 0 by default and 1 with --gate
