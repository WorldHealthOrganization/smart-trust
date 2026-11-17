# The schema-graph projection's validator knows every kind the generator
# emits. Each Scenario names the test that executes it.
Feature: Schema-graph declaration kinds

  @test:scripts/tests/schema-graph-kinds.test.ts::schema-graph_kinds::the_validator_accepts_every_kind_the_generator_emits,_and_nothing_else
  Scenario: The validator's kinds are exactly the emitted kinds
    Given an exhaustive record over DeclKind
    Then the sorted DECL_KINDS equal the record's sorted keys

  @test:scripts/tests/schema-graph-kinds.test.ts::schema-graph_kinds::DECL_KINDS_names_only_DeclKinds_(a_compile-time_check,_asserted_at_run_time_too)
  Scenario: DECL_KINDS is typed as DeclKinds
    # Gap: the type check happens only under tsc; at run time the test asserts only that the two lists have the same length.
    Given DECL_KINDS assigned to a readonly DeclKind array
    Then its length equals the number of emitted kinds
