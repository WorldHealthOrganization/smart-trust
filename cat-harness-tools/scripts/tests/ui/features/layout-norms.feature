# scripts/check-layout-norms.ts: reports a declared directory nested inside another declared directory, ratcheted
# against a baseline, with sub-graph kinds declared within their parent's kind sanctioned. Each Scenario names the test that executes it.
Feature: Layout norms: no declared directory nests inside another

  @test:scripts/tests/ui/layout-norms.test.ts::a_typology_declared_`within`_its_parent's_kind_is_sanctioned_—_`8pzh`::is_NOT_reported_when_the_child's_kind_is_`within`_the_parent's
  Scenario: A child directory whose kind is within the parent's kind is not reported
    Given a fixture layer with a "library/" directory and a nested "library/e1/out/" of a kind registered within "library"
    When the layout norms are checked with no baseline
    Then the result is determined
    And no nesting is found

  @test:scripts/tests/ui/layout-norms.test.ts::a_typology_declared_`within`_its_parent's_kind_is_sanctioned_—_`8pzh`::IS_reported_when_the_child's_kind_is_`within`_some_OTHER_kind
  Scenario: A child directory whose kind is within some other kind is reported
    Given a fixture layer with a "library/" directory and a nested "library/e1/out/" of a kind registered within "methodology"
    When the layout norms are checked with no baseline
    Then the unexpected pairs are exactly thing "library/" containing "library/e1/out/"

  @test:scripts/tests/ui/layout-norms.test.ts::the_ratchet_bites_—_the_test_that_matters::REPORTS_and_FAILS_a_nested_declaration_that_is_not_baselined
  Scenario: A nested declaration that is not baselined is reported and fails
    Given a fixture layer declaring "skills/" and "skills/voices/"
    When the layout norms are checked against a missing baseline
    Then the result is determined
    And the found pairs are exactly thing "skills/" containing "skills/voices/"
    And the unexpected pairs equal the found pairs

  @test:scripts/tests/ui/layout-norms.test.ts::the_ratchet_bites_—_the_test_that_matters::does_NOT_fail_a_pair_that_is_in_the_baseline_—_outstanding_work_is_not_a_wolf
  Scenario: A nested pair that is in the baseline does not fail
    Given a fixture layer declaring "skills/" and "skills/voices/"
    And a baseline listing that pair
    When the layout norms are checked
    Then one pair is found
    And there are no unexpected pairs
    And there are no fixed pairs

  @test:scripts/tests/ui/layout-norms.test.ts::the_ratchet_bites_—_the_test_that_matters::reports_a_baselined_pair_that_is_GONE_as_fixed,_never_as_a_failure
  Scenario: A baselined pair that is gone is reported as fixed, not as a failure
    Given a fixture layer declaring only "skills/"
    And a baseline listing thing "skills/" containing "skills/voices/"
    When the layout norms are checked
    Then no pair is found
    And there are no unexpected pairs
    And that pair is reported as fixed

  @test:scripts/tests/ui/layout-norms.test.ts::the_ratchet_bites_—_the_test_that_matters::an_instance_with_no_nesting_is_clean,_which_is_what_`<stub>/<asset>`_looks_like
  Scenario: An instance with no nesting is clean
    Given a fixture layer declaring "skills/", "processes/" and "library/" side by side
    When the layout norms are checked
    Then no nesting is found

  @test:scripts/tests/ui/layout-norms.test.ts::the_ratchet_bites_—_the_test_that_matters::an_empty_repository_is_UNDETERMINED,_not_clean
  Scenario: An empty repository is undetermined, not clean
    Given an empty repository
    When the layout norms are checked
    Then the result is undetermined

  @test:scripts/tests/ui/layout-norms.test.ts::the_real_corpus::read_more_than_one_instance_—_otherwise_everything_below_is_vacuous
  Scenario: The real corpus check reads more than five instances
    Given this repository's corpus
    When the layout norms are checked
    Then the result is determined
    And more than 5 instances were read

  @test:scripts/tests/ui/layout-norms.test.ts::the_real_corpus::has_no_unexpected_nesting_—_every_pair_found_is_baselined
  Scenario: The real corpus has no unexpected nesting
    Given this repository's corpus
    When the layout norms are checked
    Then there are no unexpected pairs

  @test:scripts/tests/ui/layout-norms.test.ts::the_real_corpus::NO_METHODOLOGY_ASSET_IS_BURIED_—_the_point_of_the_2026-09-22_move
  Scenario: No cat-harness methodology directory is nested
    Given this repository's corpus
    When the layout norms are checked
    Then no found pair starts with "cat-harness: methodologies "
    And no baselined pair does either

  @test:scripts/tests/ui/layout-norms.test.ts::the_real_corpus::the_baseline_names_only_pairs_that_are_really_there
  Scenario: The baseline names only pairs that are really there
    Given this repository's corpus and its baseline
    When the layout norms are checked
    Then no baselined pair is reported as fixed

  @test:scripts/tests/ui/layout-norms.test.ts::the_real_corpus::every_pair_found_is_named_once
  Scenario: Every pair found in the corpus is named once
    Given this repository's corpus
    When the layout norms are checked
    Then the found pairs hold no duplicates

  @test:scripts/tests/ui/layout-norms.test.ts::the_real_corpus::each_nesting_is_counted_ONCE,_however_many_ids_resolve_to_it
  Scenario: Each nesting is counted once however many ids resolve to it
    # Gap: only checks the real corpus's found pairs hold no duplicates; no fixture with several ids for one nesting is built
    Given this repository's corpus
    When the layout norms are checked
    Then the found pairs hold no duplicates

  @test:scripts/tests/ui/layout-norms.test.ts::it_asks_the_schema_rather_than_computing_geometry::does_not_flag_a_two-segment_path_that_is_not_inside_a_declared_directory
  Scenario: A two-segment path not inside a declared directory is not flagged
    Given a fixture layer declaring "skills/" and "test/results/"
    When the layout norms are checked
    Then no nesting is found

  @test:scripts/tests/ui/layout-norms.test.ts::it_asks_the_schema_rather_than_computing_geometry::the_repository_root_it_defaults_to_is_this_checkout
  Scenario: The default repository root is this checkout
    # Gap: compares the test's own REPO_ROOT with the parent of the instance root; the checker's default root is not read
    Given the instance root of this layer
    When the repository root is computed
    Then it is the instance root's parent directory
