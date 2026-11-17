# scripts/merge-watch.ts (`merge:watch`) gives a PR head its verdict by rule 1 of the
# merge-sweep rules, with every judge counted. Each Scenario names the test that executes it.
Feature: Merge watch verdict per rule 1

  @test:scripts/tests/sdlc/merge-watch.test.ts::merge:watch_verdict_per_rule_1::the_fixture_covers_the_named_cases
  Scenario: The verdict fixture covers the named cases
    Given the merge-watch cases fixture
    When its case names are listed
    Then they include fast-tier-only, cancelled-then-superseded, queued-judge, red-shard-no-judge and red-shard-judge-passes
    And they include red-shard-judge-passes-no-table, shard-table-lists-new-failures, red-check-no-judge-names, one-of-two-judges-red and ready-for-review-run-queued

  @test:scripts/tests/sdlc/merge-watch.test.ts::merge:watch_verdict_per_rule_1::%s
  Scenario: Each fixture case's check runs, workflow runs and logs give its expected verdict
    Given a fixture case with a PR's draft state, check runs, workflow runs and job logs
    When the verdict is taken and formatted
    Then it is the case's expected text
    And the 17 cases expect green for cancelled-then-superseded, red-shard-judge-passes and matrix-shards-all-green
    And they expect "draft" for a draft, "unknown: log not read" for an unreadable shard log, and a named pending or red verdict for each other case

  @test:scripts/tests/sdlc/merge-watch.test.ts::merge:watch_verdict_per_rule_1::no_checks_at_all_is_pending,_never_green
  Scenario: No checks at all is pending, never green
    Given a ready PR with no check runs and no workflow runs
    When the verdict is taken and formatted
    Then it is "pending: no checks"
