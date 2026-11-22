# scripts/check-bean-issue-links.ts reads bean-to-issue links; orphanIssues finds open issues that no open bean names.
# Each Scenario names the test that executes it.
Feature: Issues no open bean names

  @test:scripts/tests/check-bean-issue-links.test.ts::orphanIssues::an_issue_an_open_bean_names_is_not_an_orphan
  Scenario: An issue an open bean names is not an orphan
    Given open issues 100 and 200
    And an index where issue 100 is named by one bean
    When orphanIssues runs
    Then the only orphan is issue 200 "named by nobody"

  @test:scripts/tests/check-bean-issue-links.test.ts::orphanIssues::no_beans_at_all_means_every_issue_is_an_orphan
  Scenario: With no beans every issue is an orphan
    Given open issues 100 and 200 and an empty bean index
    When orphanIssues runs
    Then both issues are orphans

  @test:scripts/tests/check-bean-issue-links.test.ts::orphanIssues::a_bean_naming_an_issue_that_is_not_open_is_not_consulted_here
  Scenario: A bean naming an issue that is not in the open list leaves every open issue orphaned
    Given open issues 100 and 200
    And an index where only issue 999 is named by a bean
    When orphanIssues runs
    Then both open issues are orphans

  @test:scripts/tests/check-bean-issue-links.test.ts::orphanIssues::it_is_pure_—_the_caller_does_the_asking
  Scenario: With no issues and no beans there are no orphans
    Given an empty bean index and an empty issue list
    When orphanIssues runs
    Then it returns an empty list
    # Gap: purity (no network access) is not checked; only the empty-input result is.
