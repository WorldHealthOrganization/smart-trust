# The package scripts of the judge-mode gates in cat-harness-tools/package.json must pass "--against main", or
# they have no baseline and can never fail on a new finding. Each Scenario names the test that executes it.
Feature: Judge gates name their baseline

  @test:scripts/tests/sdlc/judge-gates-against.test.ts::bean_oqe3:_judge_gates_name_their_baseline::%s_passes_--against_main
  Scenario: Each judge gate's package script passes --against main
    Given a judge gate from the list, such as "lsi:skills:check", "kg:audit:check", "check:term-mapping", "check:reference-direction:check" or "check:harness-state:check"
    When its command is read from the package scripts
    Then the script exists
    And the command runs in check mode
    And the command contains "--against main"
