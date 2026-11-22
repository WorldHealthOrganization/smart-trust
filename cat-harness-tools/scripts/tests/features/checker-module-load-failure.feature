# pipeline/qa-checker-discovery.ts loads QA checker modules through loadCheckerModule, which caches
# each result so a module whose top level throws is reported as a load error and never imported twice.
# Each Scenario names the test that executes it.
Feature: A checker module that will not load is loaded once and remembered

  @test:scripts/tests/checker-module-load-failure.test.ts::what_a_failed_import_does,_and_what_it_does_NOT_do::the_module_is_evaluated_ONCE,_whatever_the_second_import_reports
  Scenario: A module that throws at its top level is evaluated only once
    Given a fixture module that throws "this checker module cannot load" at its top level and counts its evaluations
    When it is imported
    Then the import rejects with that message
    And the module has been evaluated once
    When it is imported a second time
    Then it still has been evaluated only once
    And if the second import resolved, listing its keys throws "before initialization" and readModule returns nothing

  @test:scripts/tests/checker-module-load-failure.test.ts::loadCheckerModule::a_failure_is_remembered_as_a_failure,_not_retried
  Scenario: A load failure is cached and not retried
    Given an empty module cache and an unimported fixture that throws at its top level
    When loadCheckerModule is called twice for it
    Then both results carry a loadError containing "this checker module cannot load"
    And the second result is the same object as the first
    And the fixture was evaluated once

  @test:scripts/tests/checker-module-load-failure.test.ts::loadCheckerModule::a_module_that_loads_is_cached_as_its_namespace
  Scenario: A module that loads is cached as its namespace
    Given an empty module cache
    When loadCheckerModule loads pipeline/qa-checker-discovery.ts
    Then the result has no loadError
    And loading it again returns the same object
