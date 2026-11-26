# run-gates.py folds skill:register:check down to its declaration half when every chain check it would run
# is already its own gate. Each Scenario names the test that executes it.
Feature: skill:register:check runs only its declaration half when the gates cover its chain

  @test:test/layer-pr-checks-skill-register-fold.test.ts::run-gates.py_skill:register_fold::every_chain_check_is_a_gate:_the_gate_runs_the_declaration_half,_once
  Scenario: When every chain check is a gate the skill:register gate runs the declaration half once
    Given gates for "skill:register:check", "a:check", "b:check" and "skill:register:declarations:check"
    And a skill-register.ts whose chain verifies "a:check" and "b:check"
    When run-gates.py folds the skill:register gate
    Then the skill:register gate runs "bun run cat skill:register:declarations:check"
    And the separate declarations gate is removed

  @test:test/layer-pr-checks-skill-register-fold.test.ts::run-gates.py_skill:register_fold::a_chain_check_that_is_not_a_gate:_the_full_check_runs
  Scenario: When a chain check is not a gate the full check runs
    Given the same gates and a chain that verifies "a:check" and "c:check"
    When run-gates.py folds the skill:register gate
    Then the skill:register gate still runs "bun run cat skill:register:check"

  @test:test/layer-pr-checks-skill-register-fold.test.ts::run-gates.py_skill:register_fold::the_chain_cannot_be_read:_the_full_check_runs
  Scenario: When the chain cannot be read the full check runs
    Given the same gates and no skill-register.ts
    When run-gates.py folds the skill:register gate
    Then the skill:register gate still runs "bun run cat skill:register:check"
