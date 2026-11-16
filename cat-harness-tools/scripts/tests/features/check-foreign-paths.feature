# scripts/check-foreign-paths.ts counts, per file, string literals that spell a path into a directory only another
# instance declares, and holds those counts to a one-way ratchet against a recorded baseline.
# Each Scenario names the test that executes it.
Feature: Code does not spell paths into another instance's directories

  @test:scripts/tests/check-foreign-paths.test.ts::which_names_are_foreign::a_name_only_another_instance_declares_is_foreign;_a_shared_name_is_not_(the_`docs/`_rule,_shown_with_`themes`)
  Scenario: Only names that another instance alone declares are foreign
    Given a root instance declaring "beans", "fsh-guts", "themes" and "uploads"
    And a harness instance declaring "harness/themes" and "harness/skills"
    When the foreign targets for the harness are computed
    Then they are exactly "beans", "fsh-guts" and "uploads"

  @test:scripts/tests/check-foreign-paths.test.ts::which_names_are_foreign::a_directory_inside_the_scanner's_own_tree_is_never_foreign_to_it
  Scenario: A directory inside the scanner's own tree is never foreign to it
    When the foreign targets for the root instance are computed
    Then they do not include "harness/themes"

  @test:scripts/tests/check-foreign-paths.test.ts::what_a_scan_counts::a_spelled_path_into_another_instance's_directory_is_counted,_with_its_owner
  Scenario: A spelled path into another instance's directory is counted with its owner
    Given a harness script containing the literal "fsh-guts/uploads"
    When it is scanned
    Then one site is counted, with target "fsh-guts", owner "root" and line 1

  @test:scripts/tests/check-foreign-paths.test.ts::what_a_scan_counts::a_bare_segment_counts_only_as_the_first_literal_of_a_path-building_call
  Scenario: A bare segment counts only as the first literal of a path-building call
    Given a call joining ROOT with "beans" and "defs"
    Then scanning it counts one site
    And an object property "beans" counts none
    And "beans" as a later literal after "x" in a join counts none

  @test:scripts/tests/check-foreign-paths.test.ts::what_a_scan_counts::a_`../`_path_from_the_instance's_root_resolves_before_matching
  Scenario: A parent-relative path is resolved before matching
    Given the literal "../uploads/a.pdf" in a harness script
    When it is scanned
    Then one site is counted

  @test:scripts/tests/check-foreign-paths.test.ts::what_a_scan_counts::comments,_templates_and_sentences_are_not_paths
  Scenario: Comments, template literals and sentences are not paths
    Given a comment naming "beans/defs", a template literal starting "fsh-guts/" and the sentence "beans/ is the work plan"
    When they are scanned
    Then no site is counted

  @test:scripts/tests/check-foreign-paths.test.ts::what_a_scan_counts::a_name_the_scanner_also_declares_is_not_a_finding_(the_false_positive_the_shared-name_rule_exists_for)
  Scenario: A name the scanner also declares is not a finding
    Given a join of ROOT with "themes" and "index.md"
    When it is scanned
    Then no site is counted

  @test:scripts/tests/check-foreign-paths.test.ts::what_a_scan_counts::a_module_specifier_is_code,_not_a_path_into_a_directory
  Scenario: A module specifier is not a path into a directory
    Given a dynamic import of "../beans/x.js"
    When it is scanned
    Then no site is counted

  @test:scripts/tests/check-foreign-paths.test.ts::what_a_scan_counts::a_literal_nested_in_another_call_inside_the_path_call_is_not_the_path_(an_option_name)
  Scenario: A literal nested in another call inside a path call is not the path
    Given a resolve call whose argument is opt("beans")
    When it is scanned
    Then no site is counted

  @test:scripts/tests/check-foreign-paths.test.ts::what_a_scan_counts::a_segment_joined_onto_the_INSTANCE's_own_root_is_the_instance's_own
  Scenario: A segment joined onto the instance's own root is the instance's own
    Given "beans" joined onto INSTANCE, and onto import.meta.dir and ".."
    Then scanning either counts no site
    And "beans" joined onto REPO counts one site

  @test:scripts/tests/check-foreign-paths.test.ts::what_a_scan_counts::a_marked_site_is_reported_with_its_reason,_not_counted
  Scenario: A site marked as a declared path literal is reported with its reason, not counted
    Given a "declared-path-literal" comment giving a reason, above the literal "fsh-guts/logs"
    When it is scanned
    Then no site is counted
    And the marked site's reason mentions "ignore file"

  @test:scripts/tests/check-foreign-paths.test.ts::the_ratchet_is_one_way::a_rise_is_red,_naming_the_file
  Scenario: A rise in a file's count fails and names the file
    Given a baseline of 1 for "a.ts" and a current count of 2
    When the counts are judged
    Then the exit code is 1
    And "a.ts" is reported over, from 1 to 2

  @test:scripts/tests/check-foreign-paths.test.ts::the_ratchet_is_one_way::a_new_file_with_any_foreign_literal_is_red
  Scenario: A new file with any foreign literal fails
    Given an empty baseline and a count of 1 for "new.ts"
    When the counts are judged
    Then the exit code is 1

  @test:scripts/tests/check-foreign-paths.test.ts::the_ratchet_is_one_way::a_fall_is_reported,_never_red_—_a_fix_elsewhere_must_not_redden_an_unrelated_PR
  Scenario: A fall in a file's count is reported but never fails
    Given a baseline of 3 for "a.ts" and no current count
    When the counts are judged
    Then the exit code is 0
    And "a.ts" is reported under, from 3 to 0

  @test:scripts/tests/check-foreign-paths.test.ts::notThisCheckouts_—_mounted_code_spelling_the_root's_own_directories::a_mounted_layer's_site_on_the_root's_directory_is_excused;_the_rest_still_count
  Scenario: A mounted layer's site on the root instance's directory is excused
    Given a root instance declaring "docs" and a mounted fhir-harness
    And counted sites in "cat-harness-tools/scripts/sync-docs-harness.ts" and "scripts/local.ts" on "docs", and in "cat-harness-tools/scripts/x.ts" on fhir-harness's directory
    When sites in mounted layers "cat-harness-tools" and "fhir-harness" are filtered
    Then only "cat-harness-tools/scripts/sync-docs-harness.ts" is excused
    And "scripts/local.ts" and "cat-harness-tools/scripts/x.ts" still count

  @test:scripts/tests/check-foreign-paths.test.ts::notThisCheckouts_—_mounted_code_spelling_the_root's_own_directories::nothing_is_excused_where_the_root_declares_no_instance_(the_platform_index)
  Scenario: Nothing is excused when the root declares no instance
    Given the same sites with only fhir-harness declared
    When the sites are filtered
    Then nothing is excused
    And all 3 sites still count

  @test:scripts/tests/check-foreign-paths.test.ts::notThisCheckouts_—_mounted_code_spelling_the_root's_own_directories::nothing_is_excused_when_the_file's_layer_is_not_mounted_by_the_lock
  Scenario: Nothing is excused when no layer is mounted
    Given the same sites and instances but no mounted layers
    When the sites are filtered
    Then nothing is excused

  @test:scripts/tests/check-foreign-paths.test.ts::a_block_that_MOVES_between_files_is_the_same_finding_(dth-sc#24)::moved_unchanged:_the_keys_CI_compares_are_identical
  Scenario: A block moved unchanged between files gives CI the same keys
    Given a block with one "fsh-guts" and one "uploads" literal, reported in "harness/front-matter/p-front-page-008.ts"
    And the same block reported in "harness/glossary/p-front-page-008.ts"
    When CI's gate_diagnostics parser reads each report
    Then the first yields 2 keys
    And the second yields the identical keys

  @test:scripts/tests/check-foreign-paths.test.ts::a_block_that_MOVES_between_files_is_the_same_finding_(dth-sc#24)::a_site_really_ADDED_is_still_one_more_of_its_key
  Scenario: A site really added still adds a key
    Given the block once in "harness/front-matter/p.ts" and twice in "harness/glossary/p.ts"
    When CI's gate_diagnostics parser reads each report
    Then the second yields twice as many keys as the first

  @test:scripts/tests/check-foreign-paths.test.ts::a_block_that_MOVES_between_files_is_the_same_finding_(dth-sc#24)::where_it_sits_is_still_printed,_under_the_finding
  Scenario: The site's location is still printed under the finding
    Given the block reported in "harness/glossary/p.ts"
    Then the report contains "at harness/glossary/p.ts:1"
