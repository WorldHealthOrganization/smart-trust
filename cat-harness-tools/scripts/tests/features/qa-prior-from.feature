# --prior-from <ref> (bean 8wj1): a block writer reads the earlier report from
# the qa-reports branch at <ref>, never the working copy, and refuses a read
# it cannot complete. The branch half runs against a real bare repository
# over file://. Each Scenario names the test that executes it.
Feature: A block writer reads its prior report from the qa-reports branch

  @test:scripts/tests/qa-prior-from.test.ts::--prior-from_parses_or_refuses::absent,_separate_and_=_forms;_a_missing_or_full_ref_is_a_usage_error
  Scenario: --prior-from parses a ref or refuses
    Then the flag is "--prior-from"
    And it is absent from ["--paper", "x"]
    And "--prior-from main" gives "main" and "--prior-from=pr/12" gives "pr/12"
    And "--prior-from" with nothing, with "--strict", or with "refs/heads/main" is a usage error

  @test:scripts/tests/qa-prior-from.test.ts::loadPriorBlockReport_--prior-from_reads_the_branch,_never_the_working_copy::a_published_report_is_read_from_qa-reports
  Scenario: A published report is read from qa-reports
    Given a block report published to qa-reports at main/<sha>, and the working copy removed
    When the prior report is loaded from "main"
    Then it is ok, from "qa-reports:main/<sha>", with criteria ["a"]

  @test:scripts/tests/qa-prior-from.test.ts::loadPriorBlockReport_--prior-from_reads_the_branch,_never_the_working_copy::no_report_at_the_ref_is_a_block_with_no_history,_not_a_refusal
  Scenario: No report at the ref is a block with no history
    Given nothing published, and a block report in the working copy
    When the prior report is loaded from "main"
    Then it is ok with no report

  @test:scripts/tests/qa-prior-from.test.ts::loadPriorBlockReport_--prior-from_reads_the_branch,_never_the_working_copy::an_unreachable_store_refuses,_and_does_not_fall_back_to_the_working_copy
  Scenario: An unreachable store refuses without falling back
    Given a block report in the working copy and a remote that does not exist
    When the prior report is loaded from "main"
    Then it is not ok, in state "unknown"
    And its refusal line says "Nothing was written"

  @test:scripts/tests/qa-prior-from.test.ts::loadPriorBlockReport_--prior-from_reads_the_branch,_never_the_working_copy::a_report_at_the_ref_that_is_not_block-qa/v1_is_corrupt,_and_refused
  Scenario: A report at the ref that is not block-qa/v1 is refused as corrupt
    Given a non-block-qa document published at main/<sha>
    When the prior report is loaded from "main"
    Then it is not ok, in state "corrupt"
