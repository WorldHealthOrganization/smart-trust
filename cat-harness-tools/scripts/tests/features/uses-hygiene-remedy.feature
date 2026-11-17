# uses-editorial-hygiene reports transitive redundancy over uses only (owner
# ruling 2026-08-24). Skipped when no folio is attached. Each Scenario names the
# test that executes it.
Feature: uses-editorial-hygiene redundancy walks uses only

  @test:scripts/tests/uses-hygiene-remedy.test.ts::uses-editorial-hygiene_redundancy_walks_`uses`_only::a_warn_fires_iff_a_uses-only_redundancy_exists
  Scenario: A warn fires exactly when a uses-only redundancy exists
    # Gap: over a folio where no block warns and no interprets-only path exists, every assertion is skipped and the test passes having checked nothing (it only logs that).
    Given an attached folio
    When every block is checked and its uses cone and editorial cone are computed
    Then a warning block has a uses-only redundancy and a passing block has none
    And a block redundant only through the editorial cone does not warn

  @test:scripts/tests/uses-hygiene-remedy.test.ts::uses-editorial-hygiene_redundancy_walks_`uses`_only::the_remedy_named_is_one_that_applies_to_every_finding
  Scenario: The named remedy applies to every finding
    # Gap: passes with no assertion when no block warns, and skips any hit whose text does not match the "redundant ... already reachable via ..." pattern.
    Given an attached folio
    When a block warns of a redundant entry reachable via another
    Then that entry is in the other's uses cone
    And the finding says "run prune-transitive-deps.ts"
