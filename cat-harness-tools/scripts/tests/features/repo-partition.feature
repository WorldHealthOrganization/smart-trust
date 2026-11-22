# The repo-partition analysis: each module is classified to a repository by
# an explicit rule, a test rule, a domain keyword, or not at all, and the
# imports that cross a boundary are reported. Each Scenario names the test
# that executes it.
Feature: Modules are partitioned between repositories

  @test:scripts/tests/repo-partition.test.ts::repo-partition_classification::explicit_path_rules_win_over_keyword_rules
  Scenario: Explicit path rules win over keyword rules
    Then schemas/content/avatars.ts and schemas/ui/blank-avatar.ts are "harness" by "rule"

  @test:scripts/tests/repo-partition.test.ts::repo-partition_classification::a_test_is_classified_by_what_it_IS,_not_by_what_it_exercises
  Scenario: A test is classified as a test
    Then scripts/tests/lean-witness.test.ts is "test" by "rule"

  @test:scripts/tests/repo-partition.test.ts::repo-partition_classification::domain_keywords_assign_with_keyword_provenance,_not_rule
  Scenario: Domain keywords assign with keyword provenance
    Then pipeline/render-latex.ts is "sci" by "keyword"

  @test:scripts/tests/repo-partition.test.ts::repo-partition_classification::an_unclaimed_module_is_unassigned_—_never_silently_defaulted_to_core
  Scenario: An unclaimed module is unassigned
    Then an unrecognised platform script is "unassigned" by "default"

  @test:scripts/tests/repo-partition.test.ts::repo-partition_analysis::scans_a_non-empty_corpus
  Scenario: The analysis scans a non-empty corpus
    When the partition is analysed
    Then it holds more than 100 modules and more than 100 edges

  @test:scripts/tests/repo-partition.test.ts::repo-partition_analysis::a_test_module's_cross-boundary_imports_are_never_violations
  Scenario: A test module's cross-boundary imports are never violations
    # Gap: the loop passes vacuously if there are no cross edges at all; nothing asserts there is one.
    When the partition is analysed
    Then no cross edge starts from a "test" module

  @test:scripts/tests/repo-partition.test.ts::repo-partition_analysis::every_cross-edge_has_both_endpoints_classified
  Scenario: Every cross edge has both endpoints classified
    # Gap: the loop passes vacuously if there are no cross edges at all.
    When the partition is analysed
    Then both ends of every cross edge are classified modules
