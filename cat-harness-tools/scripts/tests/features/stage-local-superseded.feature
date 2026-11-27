# A main publish whose commit a newer push replaced is superseded, not failed;
# a local commit nobody pushed is still an error. Each Scenario names the test
# that executes it.
Feature: Superseded main publishes

  @test:scripts/tests/stage-local-superseded.test.ts::notTipError::HEAD_behind_the_tip_is_superseded
  Scenario: HEAD behind the tip is superseded
    Given a repository with two commits
    When HEAD is the first and origin/main's tip the second
    Then the error is a SupersededError saying HEAD "is not origin/main's tip"

  @test:scripts/tests/stage-local-superseded.test.ts::notTipError::HEAD_ahead_of_the_tip_(a_commit_nobody_pushed)_stays_an_error
  Scenario: HEAD ahead of the tip is an error
    When HEAD is the second commit and origin/main's tip the first
    Then the error is not a SupersededError and says HEAD "is not origin/main's tip"
