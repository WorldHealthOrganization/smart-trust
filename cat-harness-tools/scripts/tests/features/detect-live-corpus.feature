# scripts/detect-live-corpus.ts (qrlc) is the live-vs-latent probe: it compares the change-sets of a clean
# and a planted run, and derives the writer scripts from package.json without a roster.
# Each Scenario names the test that executes it.
Feature: Live-vs-latent corpus probe

  @test:scripts/tests/detect-live-corpus.test.ts::differingPaths_—_what_makes_a_run_LIVE::identical_change-sets_are_latent
  Scenario: Identical change-sets differ in no path
    Given a clean and a planted change-set that both hold "a.json" with content "1"
    When their differing paths are computed
    Then the result is empty

  @test:scripts/tests/detect-live-corpus.test.ts::differingPaths_—_what_makes_a_run_LIVE::the_same_path_with_different_CONTENT_is_live
  Scenario: The same path with different content is a differing path
    Given a clean change-set with "a.json" as "1" and a planted one with "a.json" as "2"
    When their differing paths are computed
    Then the result is ["a.json"]

  @test:scripts/tests/detect-live-corpus.test.ts::differingPaths_—_what_makes_a_run_LIVE::a_path_only_the_planted_run_touched_is_live
  Scenario: A path only the planted run touched is a differing path
    Given an empty clean change-set and a planted one holding "b.json"
    When their differing paths are computed
    Then the result is ["b.json"]

  @test:scripts/tests/detect-live-corpus.test.ts::differingPaths_—_what_makes_a_run_LIVE::and_so_is_a_path_only_the_CLEAN_run_touched_—_both_directions
  Scenario: A path only the clean run touched is a differing path too
    Given a clean change-set holding "c.json" and an empty planted one
    When their differing paths are computed
    Then the result is ["c.json"]

  @test:scripts/tests/detect-live-corpus.test.ts::derivedWriters_—_no_roster::a_script_counts_as_a_writer_exactly_when_its_`:check`_sibling_exists
  Scenario: A script is a writer exactly when its ":check" sibling exists
    Given a package.json with scripts "auto:docs", "auto:docs:check", "lonely:check" and "solo"
    When the writers are derived from it
    Then the result is ["auto:docs"]
