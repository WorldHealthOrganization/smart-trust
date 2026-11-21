# check-usage-paths.ts: a script's usage string must name the script.
# Each Scenario names the test that executes it.
Feature: Usage paths name their own script

  @test:scripts/tests/usage-paths-self-reference.test.ts::namesSelf_—_the_suffix_rule,_not_a_basename_rule::a_pre-split_root_is_a_suffix_and_so_names_the_file
  Scenario: A path suffix names the file
    Then "pipeline/build.ts" names "cat-harness/content/pipeline/build.ts"
    And "pipeline/qa-sweep.ts" and "render-log.ts" name their files

  @test:scripts/tests/usage-paths-self-reference.test.ts::namesSelf_—_the_suffix_rule,_not_a_basename_rule::the_file's_own_full_path_names_it
  Scenario: The full path names the file
    Then "cat-harness/scripts/a.ts" names itself

  @test:scripts/tests/usage-paths-self-reference.test.ts::namesSelf_—_the_suffix_rule,_not_a_basename_rule::a_basename_collision_on_a_DIFFERENT_file_is_not_a_self-reference
  Scenario: A same basename on another file is not a self-reference
    Then "src/index.ts" does not name "cat-harness/tools/index.ts"
    But it names "cat-harness/src/index.ts"

  @test:scripts/tests/usage-paths-self-reference.test.ts::namesSelf_—_the_suffix_rule,_not_a_basename_rule::a_spelling_longer_than_the_file's_own_path_cannot_be_a_suffix
  Scenario: A longer spelling is not a suffix
    Then "cat-harness/scripts/a.ts" does not name "scripts/a.ts"

  @test:scripts/tests/usage-paths-self-reference.test.ts::namesSelf_—_the_suffix_rule,_not_a_basename_rule::the_match_is_segment-wise,_so_a_shared_tail_of_one_segment_does_not_count
  Scenario: Matching is by whole segments
    Then "build.ts" does not name "cat-harness/scripts/prefix-build.ts"

  @test:scripts/tests/usage-paths-self-reference.test.ts::subjectFiles_—_the_subject_set_comes_from_git::only_subject_extensions_survive
  Scenario: Only .ts, .sh and .py are subjects
    Given a lister offering a.ts, b.sh, c.py, d.md and e.json
    Then the subjects are a.ts, b.sh and c.py

  @test:scripts/tests/usage-paths-self-reference.test.ts::subjectFiles_—_the_subject_set_comes_from_git::tests_are_dropped,_by_suffix_and_by_directory
  Scenario: Tests are not subjects
    Given a lister offering "scripts/a.test.ts", "scripts/tests/b.ts" and "scripts/c.ts"
    Then the only subject is "scripts/c.ts"

  @test:scripts/tests/usage-paths-self-reference.test.ts::subjectFiles_—_the_subject_set_comes_from_git::an_ignored_path_is_absent_because_git_never_offered_it
  Scenario: Only what the lister offers is a subject
    # Gap: uses an injected lister, so git and its ignore rules are not exercised; it only shows the subjects are what the lister returned.
    Then a lister offering "src/c.ts" gives just that
    And an empty lister gives no subjects

  @test:scripts/tests/usage-paths-self-reference.test.ts::subjectFiles_—_the_subject_set_comes_from_git::the_real_checkout_yields_a_substantial_set_—_a_floor,_not_a_count
  Scenario: The real checkout has many subjects
    Then the checkout's parent directory yields more than 100 subject files

  @test:scripts/tests/usage-paths-self-reference.test.ts::subjectFiles_—_the_subject_set_comes_from_git::and_it_contains_no_gitignored_directory_this_container_carries
  Scenario: The real subject set has no ignored directories
    Then no subject of the checkout's parent starts with "_kg/", "schemas/" or "scripts/__pycache__/"

  @test:scripts/tests/usage-paths-self-reference.test.ts::selfReferences::a_stale_root_is_Misnames_and_carries_the_file's_own_path_as_expected
  Scenario: A stale root misnames the file
    Given "cat-harness/scripts/thing.ts" whose usage says "bun run scripts/thing.ts"
    Then its one self-reference misnames it, spelled "scripts/thing.ts", expected the full path, on line 1

  @test:scripts/tests/usage-paths-self-reference.test.ts::selfReferences::the_correct_spelling_is_Names
  Scenario: The correct spelling names the file
    Given the usage says "bun run" with the file's full path
    Then the self-reference's verdict is Names

  @test:scripts/tests/usage-paths-self-reference.test.ts::selfReferences::a_reference_to_another_file_is_not_reported_at_all
  Scenario: A reference to another file is not reported
    Given "cat-harness/tools/index.ts" saying "bun run src/index.ts"
    Then it has no self-references

  @test:scripts/tests/usage-paths-self-reference.test.ts::selfReferences::an_unreadable_file_is_Undetermined,_never_a_pass
  Scenario: An unreadable file is undetermined
    Given a file that does not exist
    Then it has one self-reference, Undetermined, with a note saying "unreadable"

  @test:scripts/tests/usage-paths-self-reference.test.ts::the_package.json_advice::scriptFor_finds_the_named_script_that_runs_the_path
  Scenario: The named script running a path is found
    Given script "qa:sweep" runs "cat-harness/content/pipeline/qa-sweep.ts"
    Then that path's script is "qa:sweep" and another path has none

  @test:scripts/tests/usage-paths-self-reference.test.ts::the_package.json_advice::rootScripts_is_{}_rather_than_a_throw_when_package.json_is_absent
  Scenario: No package.json gives no scripts
    Then the root scripts of a directory with no package.json are empty

  @test:scripts/tests/usage-paths-self-reference.test.ts::the_package.json_advice::--fix_writes_the_path,_never_the_script_name
  Scenario: The fix writes the path, not the script name
    Given a misnamed usage and a package.json script "do:thing" running the file
    Then the self-reference advises "do:thing"
    And after the fix the usage says "bun run" with the file's full path

  @test:scripts/tests/usage-paths-self-reference.test.ts::applyFix::rewrites_only_the_spelled_occurrence,_on_the_line_it_was_found_on
  Scenario: The fix rewrites only the misnamed usage
    Given a file with a misnamed "bun run" line, a "bun run" of another file, and the old spelling in a string
    When the fix is applied
    Then only this file is touched
    And only the first line is rewritten

  @test:scripts/tests/usage-paths-self-reference.test.ts::applyFix::leaves_a_file_alone_when_nothing_in_it_misnames_itself
  Scenario: A correct file is not touched
    Given a file whose usage names its full path
    Then the fix touches nothing

  @test:scripts/tests/usage-paths-self-reference.test.ts::applyFix::is_idempotent_—_a_second_pass_finds_nothing_to_do
  Scenario: The fix is idempotent
    Given a misnamed usage fixed once
    Then a second fix touches nothing

  @test:scripts/tests/usage-paths-self-reference.test.ts::the_exemption_table_cannot_outlive_what_it_exempts::an_entry_matching_nothing_is_itself_reported
  Scenario: A stale exemption is reported
    Given an exemption for "nowhere.ts" is added
    Then it is among the unmatched exemptions
    And the report says "exemption matches nothing"

  @test:scripts/tests/usage-paths-self-reference.test.ts::the_exemption_table_cannot_outlive_what_it_exempts::the_shipped_table_is_empty,_so_nothing_is_exempt_today
  Scenario: The shipped exemption table is empty
    Then the exemption table is empty

  @test:scripts/tests/usage-paths-self-reference.test.ts::report_—_could-not-determine_is_never_rendered_as_clean::an_Undetermined_verdict_says_so_and_names_exit_2
  Scenario: An undetermined report is not a pass
    When one Undetermined result is reported
    Then the report says "NOT a pass" and "Exit 2" and has no check mark

  @test:scripts/tests/usage-paths-self-reference.test.ts::report_—_could-not-determine_is_never_rendered_as_clean::a_clean_set_says_so,_with_the_count_it_checked
  Scenario: A clean report says how many it checked
    When one Names result is reported
    Then the report has a check mark and "1 self-referencing usage string"

  @test:scripts/tests/usage-paths-self-reference.test.ts::the_corpus_invariant::no_file_in_this_repository_misnames_itself
  Scenario: No file in the checkout misnames itself
    Then auditing the checkout's parent finds nothing that misnames itself

  @test:scripts/tests/usage-paths-self-reference.test.ts::the_corpus_invariant::nothing_is_Undetermined,_so_the_clean_verdict_above_covers_everything
  Scenario: Nothing in the checkout is undetermined
    Then auditing the checkout's parent finds nothing Undetermined

  @test:scripts/tests/usage-paths-self-reference.test.ts::the_corpus_invariant::MUTATION:_reintroducing_a_pre-split_spelling_is_caught
  Scenario: A pre-split spelling is caught
    Given "cat-harness/content/pipeline/build.ts" whose usage says "bun run pipeline/build.ts"
    When it is audited with an injected lister
    Then one result misnames it, spelled "pipeline/build.ts", expected the full path

  @test:scripts/tests/usage-paths-self-reference.test.ts::the_corpus_invariant::MUTATION:_the_audit_is_not_vacuous_—_it_does_find_correct_references_too
  Scenario: The audit finds correct references
    Then auditing the checkout's parent finds at least one usage that names its file
