# Specifies the tracking-issue path of the health sweep (test/health/run.ts):
# the script names a person runs, and the issue body that buildReport and
# render produce from a fixture context, plus gates() deciding whether a
# report fails the run. No real issue is opened.
Feature: The health sweep's issue body says what went blind, what was found and what to do

  @test:test/health/workflow.test.ts::the_trigger::is_also_runnable_locally,_under_a_script_name_a_person_would_guess
  Scenario: The sweep is runnable under the script names "health" and "health:list"
    Given the scripts of the repository root
    When the "health" and "health:list" scripts are read
    Then "health" runs "test/health/run.ts"
    And "health:list" passes "--list"

  @test:test/health/workflow.test.ts::the_issue_body::leads_with_'could_not_determine'_when_anything_went_blind,_not_with_the_findings
  Scenario: A report with a blind probe reads as "could not determine"
    Given a fixture context whose repository-size probe is unknown with "not a git repository"
    And a report built from it through buildReport, as the CLI builds it
    When the report is rendered
    Then the verdict is "unknown"
    And the body contains "**Could not determine.**" and "This is NOT a clean report"
    And the body contains "not a git repository"

  @test:test/health/workflow.test.ts::the_issue_body::names_every_finding_and_what_a_person_should_do_about_it
  Scenario: The body names the size finding, the orphan preview and the cleanup command
    Given the fixture report, with two 1600 MiB previews of which only "claude-one" has an open PR
    When the report is rendered
    Then the body contains "staging-preview-size", "3.13 GB", "branches/claude-two" and "staging:cleanup"
    And the body does not propose anything for the preview "claude-one"
    And the report has at least one finding, and for every finding of every check the body carries its severity and summary as a bullet and its action under "What to do"

  @test:test/health/workflow.test.ts::the_issue_body::shows_every_threshold_with_the_basis_it_was_chosen_on
  Scenario: The body has a thresholds section that names its bases
    Given the fixture report
    When the report is rendered
    Then the body contains "Thresholds, and what each is based on"
    And it contains "owner's explicit instruction"
    And it contains "NO EXTERNAL STANDARD"
    And the report has at least one threshold, and for every threshold of every check the body names its metric and carries its severity and basis

  @test:test/health/workflow.test.ts::the_issue_body::gates_on_a_major_finding,_and_not_on_a_minor_one_alone
  Scenario: A major finding gates; a minor one gates only when minors are asked to
    Given the fixture report narrowed to the staging-preview-size check
    And the fixture report narrowed to the staging-preview-orphans check
    When each is gated
    Then the size-only report gates without the minor flag
    And the orphans-only report does not gate without the minor flag
    And the orphans-only report gates with the minor flag
