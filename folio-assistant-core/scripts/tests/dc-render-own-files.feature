Feature: dc-render --check on an instance the caller does not commit

  @test:scripts/tests/dc-render-own-files.test.ts::dc-render_--check_on_an_instance_the_caller_does_not_commit::foreignScopePasses
  Scenario: scoped to another caller, it passes and says whose it is
    When the check runs scoped to another caller's layer
    Then it exits 0 and says the layer is not this caller's

  @test:scripts/tests/dc-render-own-files.test.ts::dc-render_--check_on_an_instance_the_caller_does_not_commit::unscopedJudged
  Scenario: unscoped, it judges the layer as before (here: no catalogue, a refusal)
    When the check runs unscoped on a layer with no catalogue
    Then it exits 2 saying it is not a catalogue layer

  @test:scripts/tests/dc-render-own-files.test.ts::dc-render_--check_on_an_instance_the_caller_does_not_commit::ownScopeJudged
  Scenario: scoped to the instance's own layer, it is judged as before
    When the check runs scoped to the instance's own layer
    Then it exits 2
