# scripts/orphan-pages.ts: orphanSubjectPages lists the subject-page directories no longer
# wanted, split into those this generator owns (safe to prune) and foreign ones it declines.
# Each Scenario names the test that executes it.
Feature: Orphan subject-page selection

  @test:scripts/tests/ui/orphan-pages.test.ts::the_ownership_test_is_the_parameter,_the_unit_is_not::the_default_is_self-naming,_which_is_the_strongest_test
  Scenario: A page that names its own directory is owned by default
    Given a directory "alpha" whose index.html declares SCOPE "alpha"
    When orphan subject pages are selected with nothing wanted
    Then "alpha" is owned and nothing is foreign

  @test:scripts/tests/ui/orphan-pages.test.ts::the_ownership_test_is_the_parameter,_the_unit_is_not::a_page_naming_a_DIFFERENT_directory_is_foreign,_not_owned
  Scenario: A page naming a different directory is foreign, not owned
    Given a directory "alpha" whose index.html declares SCOPE "beta"
    When orphan subject pages are selected with nothing wanted
    Then nothing is owned and "alpha" is foreign

  @test:scripts/tests/ui/orphan-pages.test.ts::the_ownership_test_is_the_parameter,_the_unit_is_not::a_marker_test_claims_what_self-naming_cannot
  Scenario: A marker ownership test claims a page that self-naming cannot
    Given a directory "beans" whose index.html carries the comment "made by the dashboards" and no SCOPE line
    When orphan subject pages are selected with the default test
    Then "beans" is foreign
    And when selected with a marker test for "made by the dashboards", "beans" is owned

  @test:scripts/tests/ui/orphan-pages.test.ts::the_ownership_test_is_the_parameter,_the_unit_is_not::a_wanted_directory_is_never_examined,_whatever_the_test_says
  Scenario: A wanted directory is never examined, whatever the ownership test
    Given a directory "alpha" whose index.html declares SCOPE "alpha"
    When orphan subject pages are selected with "alpha" wanted
    Then nothing is owned and nothing is foreign
    And the same holds with an ownership test that accepts everything

  @test:scripts/tests/ui/orphan-pages.test.ts::the_ownership_test_is_the_parameter,_the_unit_is_not::the_tests_are_composable_predicates,_usable_on_their_own
  Scenario: The ownership tests are predicates usable on their own
    Given a page declaring SCOPE "a"
    Then it declares its own directory for "a" but not for "b"
    And a page with no SCOPE line does not declare directory "a"
    And a marker test for "XX" accepts text containing "XX" and rejects "nope"

  @test:scripts/tests/ui/orphan-pages.test.ts::the_two_rules_the_merge_had_to_carry,_one_from_each_side::FROM_orphanSubjectPages:_a_directory_it_declines_is_FOREIGN,_never_silence
  Scenario: A directory the ownership test declines is reported as foreign, not dropped
    Given directories "mine" with a MARK comment, "theirs" with a hand-authored page, and "empty" holding only a README.md
    When orphan subject pages are selected with a marker test for "MARK"
    Then owned is "mine"
    And foreign is "empty" and "theirs"

  @test:scripts/tests/ui/orphan-pages.test.ts::the_two_rules_the_merge_had_to_carry,_one_from_each_side::FROM_prunableDashboards:_an_unreadable_page_is_foreign,_and_does_NOT_throw
  Scenario: An unreadable page is foreign and does not throw
    Given a directory "locked" whose index.html is itself a directory
    When orphan subject pages are selected with nothing wanted
    Then the call does not throw
    And nothing is owned and "locked" is foreign

  @test:scripts/tests/ui/orphan-pages.test.ts::the_boundaries_that_keep_pruning_safe::a_missing_parent_directory_is_not_an_error
  Scenario: A missing parent directory is not an error
    Given a parent directory that does not exist
    When orphan subject pages are selected with nothing wanted
    Then nothing is owned and nothing is foreign

  @test:scripts/tests/ui/orphan-pages.test.ts::the_boundaries_that_keep_pruning_safe::files_beside_the_subject_directories_are_ignored_entirely
  Scenario: Files beside the subject directories are ignored
    Given a self-naming directory "alpha" and a loose file "loose.html" in the parent
    When orphan subject pages are selected with nothing wanted
    Then owned is only "alpha"
    And nothing is foreign

  @test:scripts/tests/ui/orphan-pages.test.ts::the_boundaries_that_keep_pruning_safe::EMPTYING_the_keep-set_never_widens_what_is_owned
  Scenario: An empty keep-set owns only self-naming pages
    Given a self-naming directory "mine" and hand-authored directories "guides" and "reference"
    When orphan subject pages are selected with nothing wanted
    Then owned is only "mine"

  @test:scripts/tests/ui/orphan-pages.test.ts::the_boundaries_that_keep_pruning_safe::both_lists_are_sorted,_so_a_caller's_report_is_stable
  Scenario: Owned and foreign lists are sorted
    Given self-naming directories "c" and "a" and foreign directories "z" and "b"
    When orphan subject pages are selected with nothing wanted
    Then owned is "a", "c"
    And foreign is "b", "z"
