# Preview QA (scripts/preview-qa.ts): a preview build runs the tests and gates
# in the change's dependency cone, judges each against main's stored answer,
# and shows "This change (preview)" on top of every QA page, with the main QA
# report below it, unchanged. Each Scenario names the test that executes it.
Feature: Preview QA shows the change's cone on top of the QA report

  @test:scripts/tests/preview-qa.test.ts::preview-qa_select::selects_the_tests_whose_import_closure_holds_a_changed_path,_from_the_branch's_diff
  Scenario: The tests in the cone are those whose imports reach a changed path
    Given a branch that changes "src/a.ts" against main
    And a test importing "src/a.ts" and a test importing "src/c.ts"
    When the cone is selected
    Then only the test importing "src/a.ts" is selected
    And bun test is given it under the layer's directory

  @test:scripts/tests/preview-qa.test.ts::preview-qa_select::a_change_to_what_every_test_runs_under_selects_all_of_them,_and_none_is_given_to_bun_test
  Scenario: A change every test runs under selects all tests, and none is run
    Given a change to "package.json"
    When the cone is selected
    Then the selection is every test
    And bun test is given no file

  @test:scripts/tests/preview-qa.test.ts::preview-qa_judge::reads_failing_cases_by_file_from_a_junit_report
  Scenario: Failing test cases are read per file from the junit report
    Given a junit report with one failing case in "test/a.test.ts"
    When it is read
    Then that case is a failure of "test/a.test.ts" and the other file has none

  @test:scripts/tests/preview-qa.test.ts::preview-qa_judge::marks_each_check_new,_fixed,_both,_still_or_clean_against_main
  Scenario: Each check is new, fixed, both, still or clean against main
    Given a check's verdict here and on main, and its findings on each side
    When it is compared
    Then red here only is new, red on main only is fixed
    And red on both with findings added and gone is both, with nothing changed is still

  @test:scripts/tests/preview-qa.test.ts::preview-qa_judge::a_red_check_whose_main_answer_is_not_stored_is_unknown,_never_new
  Scenario: Without main's stored answer a red check is unknown, never new
    Given no stored answer for the PR's base
    When a failing test and a failing gate are judged
    Then both are unknown and the report says main's answer was not stored

  @test:scripts/tests/preview-qa.test.ts::preview-qa_judge::judges_the_selected_tests_and_the_gates_the_cone_ran,_and_counts_the_gates_outside_it
  Scenario: The selected tests and the gates the cone ran are judged; unchanged gates are counted outside
    Given three selected tests and gates that are new, fixed, both, still, not applicable, unchanged and skipped
    When they are judged against main
    Then each has its delta, the unchanged gate counts outside the cone, and the skipped one is not listed
    And new rows come first

  @test:scripts/tests/preview-qa.test.ts::preview-qa_judge::a_change_that_reaches_every_test_runs_none_and_says_so
  Scenario: A change reaching every test runs none and names the release tier
    Given a selection of every test
    When it is judged
    Then no test row is reported and a note names the release tier

  @test:scripts/tests/preview-qa.test.ts::preview-qa_page::puts_the_section_first_in_main,_with_the_main_report_below_it_unchanged
  Scenario: The section is first in main and the main report below it is unchanged
    Given a QA page and a judged report
    When the section is injected
    Then it sits before the page's own heading
    And removing it gives back the page exactly

  @test:scripts/tests/preview-qa.test.ts::preview-qa_page::injecting_twice_replaces_the_section_rather_than_stacking_a_second_one
  Scenario: A rebuild replaces the section rather than stacking another
    Given a page that already carries the section
    When a section is injected again
    Then the page carries exactly one

  @test:scripts/tests/preview-qa.test.ts::preview-qa_page::a_preview_with_no_cone_run,_or_one_for_another_commit,_says_so_and_how_to_start_one
  Scenario: A preview with no cone run says how to start one
    Given no report, or a report for another commit
    When the section is rendered
    Then it says to label the PR "preview", or that the run is not this commit's

  @test:scripts/tests/preview-qa.test.ts::preview-qa_page::escapes_what_it_shows
  Scenario: Names are escaped on the page
    Given a gate whose name holds markup
    When the section is rendered
    Then the markup is shown as text

  @test:scripts/tests/preview-qa.test.ts::preview-qa_page::finds_the_QA_pages_of_a_site,_and_puts_the_report_beside_them
  Scenario: Every QA page of a site carries the section, and the site carries the report
    Given a site with "qa.html", "docs/qa/index.html" and "index.html"
    When the section is injected into the site
    Then the two QA pages carry it, "index.html" is untouched, and "preview-qa.json" is written

  @test:scripts/tests/preview-qa.test.ts::preview-qa_page::the_CLI_judges_and_injects_from_files
  Scenario: The CLI judges from the run's files and injects into a site
    Given a selection, this run's junit and gates, and main's stored answer with its provenance
    When the CLI judges and then injects
    Then the report names main's commit and run, counts one new test, and the QA page carries the section

  @test:scripts/tests/preview-qa-record.test.ts::preview-qa_and_the_preview's_comparisons::the_build_record_hashes_a_QA_page_the_same_with_or_without_the_section
  Scenario: The build record ignores the section
    Given a QA page with the section
    When the build record hashes it
    Then the hash equals the page's without it, and "preview-qa.json" is a build fact

  @test:scripts/tests/preview-qa-record.test.ts::preview-qa_and_the_preview's_comparisons::staging-share_keeps_a_QA_page_carrying_the_section_in_the_preview
  Scenario: A QA page carrying the section is served from the preview
    Given a QA page that differs from the live one only by the section
    When staging-share compares them
    Then it is not served from the live copy, and "preview-qa.json" is never shared
