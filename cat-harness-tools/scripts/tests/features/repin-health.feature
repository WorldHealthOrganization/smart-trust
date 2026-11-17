# A re-pin that moves cat-harness-tools regenerates the checkout's own health
# report and pushes only that graph (owner, 2026-11-07, "Layer health": "A.
# The re-pin does it"). Each Scenario names the test that executes it.
Feature: A re-pin that moves the checker refreshes the layer's own health report

  @test:scripts/tests/repin-health.test.ts::checkerMoved::the_cat-harness-tools_pin_moved
  Scenario: The cat-harness-tools pin moved
    Then a lock whose cat-harness-tools sha changed counts as the checker moving

  @test:scripts/tests/repin-health.test.ts::checkerMoved::only_another_instance_moved
  Scenario: Only another instance moved
    Then two locks with the same cat-harness-tools sha do not count as the checker moving

  @test:scripts/tests/repin-health.test.ts::checkerMoved::no_lock_before,_one_now:_the_first_mount_counts_as_a_move
  Scenario: The first mount counts as a move
    Then no lock before and a lock pinning cat-harness-tools now counts as the checker moving

  @test:scripts/tests/repin-health.test.ts::checkerMoved::no_checker_pinned_now:_nothing_to_refresh
  Scenario: No checker pinned now is nothing to refresh
    Then a lock that no longer pins cat-harness-tools does not count as a move
    And a lock that is not JSON pins no cat-harness-tools

  @test:scripts/tests/repin-health.test.ts::ownGraphIds::picks_the_graph_at_the_own_path,_never_one_kept_in_another_repository
  Scenario: The own graph is the one at the own path
    Given a state-push dry run listing graphs at test/health/results and in other repositories
    Then the own graph ids for "test/health/results" are exactly ["root.health"]

  @test:scripts/tests/repin-health.test.ts::ownGraphIds::a_dry_run_that_does_not_parse_finds_nothing
  Scenario: A dry run that does not parse finds no own graph
    Then the own graph ids of "oops" are none

  @test:scripts/tests/repin-health.test.ts::refreshOwnHealth::mounts,_writes_the_report_with_--warn,_and_pushes_only_the_own_graph
  Scenario: The refresh mounts, writes the report with --warn, and pushes only the own graph
    Given a runner where state-mount exits 1
    When the own health is refreshed
    Then it is ok
    And it ran state-mount, "run.ts --warn", a state-push dry run, and a state-push of "root.health" with a regeneration message

  @test:scripts/tests/repin-health.test.ts::refreshOwnHealth::a_health_run_that_fails_pushes_nothing
  Scenario: A failing health run pushes nothing
    Given a runner where run.ts exits 2
    When the own health is refreshed
    Then it is not ok and no state-push with --id ran

  @test:scripts/tests/repin-health.test.ts::refreshOwnHealth::a_push_that_fails_is_reported
  Scenario: A failing push is reported
    Given a runner where state-push exits 1
    When the own health is refreshed
    Then it is not ok

  @test:scripts/tests/repin-health.test.ts::afterMountHealth::a_declaration_the_registry_cannot_read_is_reported,_never_thrown_(2026-11-07,_l1-extraction)
  Scenario: A declaration the registry cannot read is reported, not thrown
    Given the checker moved and a registry read that throws about graph typology "l1-extraction"
    When the after-mount health step runs
    Then its lines say "could not be determined" and name "l1-extraction"
    And nothing was run

  @test:scripts/tests/repin-health.test.ts::afterMountHealth::nothing_runs_when_the_checker_did_not_move
  Scenario: Nothing runs when the checker did not move
    When the after-mount health step runs for two locks with the same checker sha
    Then it returns nothing and nothing was run
