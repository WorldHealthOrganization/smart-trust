Feature: a scoped site's writers

  @test:scripts/lib/site-scope.test.ts::siteScopeArg::noFlagNoScope
  Scenario: with no --scope every instance is written
    When a writer is run without --scope
    Then it has no scope

  @test:scripts/lib/site-scope.test.ts::siteScopeArg::namesCommaSeparated
  Scenario: --scope names the instances, comma-separated
    When a writer is run with --scope "smart-immunizations, smart-base"
    Then its scope is smart-base and smart-immunizations

  @test:scripts/lib/site-scope.test.ts::siteScopeArg::emptyRefused
  Scenario: a --scope that names nothing is refused
    When a writer is run with --scope and no names
    Then it is refused, never read as every instance
