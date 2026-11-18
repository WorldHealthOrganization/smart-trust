# scripts/gitlab-request-review.ts (gitlab:request-review) adds reviewers to a merge request through glab with
# the "+" prefix, keeping the existing ones, and refuses bad names before glab runs. Each Scenario names the test that executes it.
Feature: Requesting merge request review through glab

  @test:scripts/tests/gitlab-request-review.test.ts::gitlab:request-review_adds_reviewers_and_keeps_the_existing_ones_(4dbr)::each_name_gets_glab's_'+'_(add)_prefix;_the_number,_when_given,_comes_first
  Scenario: Each reviewer name gets the "+" prefix and a given number comes first
    Given the arguments "12", "jane.doe" and "ci_bot", and separately the single argument "litlfred"
    When requestReviewArgv builds the argv for each
    Then the first is "mr update 12 --reviewer +jane.doe --reviewer +ci_bot"
    And the second is "mr update --reviewer +litlfred"

  @test:scripts/tests/gitlab-request-review.test.ts::gitlab:request-review_adds_reviewers_and_keeps_the_existing_ones_(4dbr)::no_name,_or_a_name_that_is_not_a_GitLab_username,_is_refused_before_glab_runs
  Scenario: No name, or a name that is not a GitLab username, is refused
    # Gap: only that requestReviewArgv throws is checked here; that glab never runs is the next Scenario
    Given no arguments, only the number "12", and the bad names "-rf", "--reviewer", "+jane", "!jane", "a b", "$(x)" and "repo.git"
    When requestReviewArgv builds the argv for each
    Then every one throws

  @test:scripts/tests/gitlab-request-review.test.ts::gitlab:request-review_adds_reviewers_and_keeps_the_existing_ones_(4dbr)::run_as_a_command:_glab_gets_that_argv;_a_bad_name_never_reaches_it
  Scenario: Run as a command, glab gets the argv and a bad name never reaches it
    Given a fake glab on the PATH that records its argv
    When the script runs with "3" and "jane.doe"
    Then it exits 0 and glab received "mr update 3 --reviewer +jane.doe"
    And when the script runs with "--assignee=x" it exits 2 and the fake glab never ran
