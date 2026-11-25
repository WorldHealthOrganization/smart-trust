# The module-scope resolution gate catches a throwing resolver called at module
# scope and does not catch its own remedy. Each Scenario names the test that executes it.
Feature: The module-scope resolution gate

  @test:scripts/tests/module-scope-resolution-gate.test.ts::the_hazard_is_caught::a_call_in_first_position
  Scenario: A resolver call in first position is caught
    Then a module-scope const bound to folioDir(ROOT) is one finding

  @test:scripts/tests/module-scope-resolution-gate.test.ts::the_hazard_is_caught::a_call_NESTED_in_another_—_the_shape_the_anchored_pattern_missed
  Scenario: A resolver call nested in another call is caught
    Then a module-scope const bound to join(folioDir(ROOT), ...) is one finding

  @test:scripts/tests/module-scope-resolution-gate.test.ts::the_hazard_is_caught::the_two_resolvers_beyond_folioDir,_which_also_throw
  Scenario: directoryForGraph and directoriesForGraph are caught too
    Then a module-scope const calling either is one finding each

  @test:scripts/tests/module-scope-resolution-gate.test.ts::the_hazard_is_caught::`let`_and_`var`,_not_just_`const`
  Scenario: let and var are caught, not just const
    Then a module-scope let or var bound to folioDir(ROOT) is one finding each

  @test:scripts/tests/module-scope-resolution-gate.test.ts::the_remedy_is_NOT_caught::deferResolution_over_a_nested_call
  Scenario: deferResolution over a nested call is not caught
    Then a const bound to deferResolution of an arrow calling folioDir has no findings

  @test:scripts/tests/module-scope-resolution-gate.test.ts::the_remedy_is_NOT_caught::a_hand-written_accessor_—_the_arrow_is_the_rule,_not_the_helper's_name
  Scenario: A hand-written accessor is not caught
    Then a const bound to an arrow returning folioDir(ROOT) has no findings

  @test:scripts/tests/module-scope-resolution-gate.test.ts::the_remedy_is_NOT_caught::a_call_inside_a_function_body_is_not_module_scope_at_all
  Scenario: A call inside a function body is not caught
    Then folioDir called inside a function has no findings

  @test:scripts/tests/module-scope-resolution-gate.test.ts::findContentRepoRoot_is_deliberately_absent::it_is_not_flagged,_because_it_cannot_throw
  Scenario: findContentRepoRoot is not flagged
    Then a module-scope const bound to findContentRepoRoot() has no findings

  @test:scripts/tests/module-scope-resolution-gate.test.ts::examining_nothing_is_not_a_pass::an_empty_repo_reports_that_it_read_no_files
  Scenario: An empty repo reports that it read no files
    When the gate runs over an empty directory
    Then it read 0 files
