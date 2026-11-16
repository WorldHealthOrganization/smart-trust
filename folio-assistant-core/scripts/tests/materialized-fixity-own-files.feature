Feature: the fixity check scoped to the files the caller owns

  @test:scripts/tests/materialized-fixity-own-files.test.ts::collect_scopes_to_the_files_the_caller_owns::owningNothingReadsNothing
  Scenario: owning nothing reads nothing
    When records are collected owning no file
    Then nothing is collected

  @test:scripts/tests/materialized-fixity-own-files.test.ts::collect_scopes_to_the_files_the_caller_owns::mountedLayerLeftOut
  Scenario: a mounted layer's records are left out, and nothing else changes
    When records are collected owning everything but who-iris
    Then no who-iris record is collected
    And the count equals the whole collection less who-iris
