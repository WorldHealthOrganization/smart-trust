# Covers scripts/render-test-report.ts: the test report's SVG badge and its Markdown page.
# Each Scenario names the test that executes it.
Feature: Test report page and badge

  @test:scripts/tests/ui/render-test-report.test.ts::the_badge::reads_the_schema's_verdict:_passed,_findings,_could_not_determine
  Scenario: The badge reads passed, findings or could not determine from the report
    Given test reports built against the test report schema
    When the badge is rendered for a completed report whose only case passed
    Then it contains "passed"
    And for a completed report with one passing and one failing case it contains "findings"
    And for a running report whose only case passed it contains "could not determine"

  @test:scripts/tests/ui/render-test-report.test.ts::the_badge::FALSIFICATION:_a_running_report_is_never_shown_as_passed
  Scenario: A running report's badge never shows passed
    Given a running report whose only case passed
    When its badge is rendered
    Then the badge does not contain ">passed<"

  @test:scripts/tests/ui/render-test-report.test.ts::the_badge::is_well-formed_SVG_with_the_run_in_its_title
  Scenario: The badge is SVG naming the run
    # Gap: the SVG is not parsed for well-formedness, and the run id is not checked to be inside the title element
    Given a completed report for run "r-abc-def" whose only case passed
    When its badge is rendered
    Then the badge starts with "<svg"
    And it contains "r-abc-def"

  @test:scripts/tests/ui/render-test-report.test.ts::the_page::the_badge_links_to_the_run
  Scenario: The page's badge links to the run file
    Given a completed report with a passing case and a warned case
    When the report page is rendered
    Then the page contains "[![passed](badge.svg)](test-run.json)"

  @test:scripts/tests/ui/render-test-report.test.ts::the_page::shows_the_recorded_measurements_as_recorded,_not_graded
  Scenario: The page shows recorded measurements without grading them
    Given a report rendered with an outcome of precision 0.9545 and recall 0.9545
    When the report page is rendered
    Then the page contains the row "| precision | 0.9545 |"
    And it contains "not graded here"

  @test:scripts/tests/ui/render-test-report.test.ts::the_page::lists_the_cases_that_did_not_simply_pass,_with_their_evidence
  Scenario: The page lists non-passing cases with their evidence
    Given a report whose case "b" is a warn with evidence "fires=true; label=not a feature"
    When the report page is rendered
    Then the page contains the row "| `b` | warn | fires=true; label=not a feature |"

  @test:scripts/tests/ui/render-test-report.test.ts::the_page::never_claims_a_total_across_plans
  Scenario: The page never claims a total across plans
    Given a rendered report page
    Then it contains "there is no total across plans"
    And it has no "total: <number>" text in any letter case
