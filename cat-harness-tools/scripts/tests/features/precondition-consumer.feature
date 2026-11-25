# The pre-execution gate has a consumer: the registered workflow_start handler
# consults a process's preconditions before starting it. Each Scenario names
# the test that executes it.
Feature: workflow_start consults the preconditions

  @test:scripts/tests/precondition-consumer.test.ts::workflow_start_consults_the_preconditions::an_UNSATISFIED_precondition_refuses_the_start,_and_names_it
  Scenario: An unsatisfied precondition refuses the start and names it
    Given a process whose checkable precondition requires a file that is absent
    When the registered workflow_start handler starts it
    Then it rejects with a refusal to start naming needs-the-file

  @test:scripts/tests/precondition-consumer.test.ts::workflow_start_consults_the_preconditions::a_COULD-NOT-DETERMINE_precondition_starts_anyway,_and_is_named_in_the_output
  Scenario: A could-not-determine precondition starts anyway and is named
    Given the required file is present and a stated precondition cannot be observed
    When the registered workflow_start handler starts the process
    Then the output says Started., names knows-what-it-is-doing, and says it could not be determined

  @test:scripts/tests/precondition-consumer.test.ts::the_gate's_own_three_states::only_`unsatisfied`_produces_a_refusal
  Scenario: Only unsatisfied produces a refusal
    When a process with one stated precondition is preflighted
    Then one precondition is undetermined, none is unsatisfied, and there is no refusal

  @test:scripts/tests/precondition-consumer.test.ts::the_gate's_own_three_states::a_process_declaring_none_says_so_rather_than_saying_nothing
  Scenario: A process declaring none says so
    When a process with no preconditions is preflighted
    Then the description says none are declared and there is no refusal

  @test:scripts/tests/precondition-consumer.test.ts::the_gate's_own_three_states::the_description_never_renders_an_undetermined_claim_as_clean
  Scenario: The description never renders an undetermined claim as clean
    When a process with one stated precondition is described
    Then the description says 1 could not be determined, names it, and does not say 1 satisfied
