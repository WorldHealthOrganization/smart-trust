# A test run record (schemas/sdlc/test-run.ts) carries a data hash and a process hash over
# disjoint inputs, reproduces them, treats unknown as a third state, and may name its plan
# and system under test. Each Scenario names the test that executes it.
Feature: Test run records with data and process hashes

  @test:schemas/test-run.test.ts::criterion_1_—_both_hashes,_neither_derivable_from_the_other::a_run_carries_a_data_hash_and_a_process_hash,_over_different_inputs
  Scenario: A run carries a data hash and a process hash over different inputs
    Given a fixture holding "corpus.json" and "runner.ts"
    When a test run is built with "corpus.json" as data and "runner.ts" as process
    Then the data and process hashes differ
    And each basis records its own single input
    And the run parses against the test-run schema

  @test:schemas/test-run.test.ts::criterion_1_—_both_hashes,_neither_derivable_from_the_other::overlapping_bases_are_REFUSED,_because_the_pair_would_say_nothing_extra
  Scenario: Overlapping data and process bases are refused
    Given a fixture holding "both.json" and "runner.ts"
    When a test run is built with "both.json" in both bases
    Then it throws a basis error
    And the error's overlap is "both.json"

  @test:schemas/test-run.test.ts::criterion_1_—_both_hashes,_neither_derivable_from_the_other::basisOverlap_reports_every_shared_input,_not_just_the_first
  Scenario: basisOverlap reports every shared input
    Given bases with inputs "p", "q", "r" and "q", "r", "s"
    When their overlap is taken
    Then it is "q" and "r"
    And bases sharing nothing overlap in nothing

  @test:schemas/test-run.test.ts::criterion_1_—_both_hashes,_neither_derivable_from_the_other::the_real_runner's_two_bases_are_in_fact_disjoint
  Scenario: The real crdm-detect runner's two bases are disjoint and readable
    # Gap: disjointness is implied only by the build not throwing; it is not asserted directly.
    Given the shipped crdm-detect eval's corpus as data and its script and skill file as process
    When a test run is built over the real checkout
    Then it does not throw for overlap
    And neither hash is unknown

  @test:schemas/test-run.test.ts::criterion_2_—_an_unchanged_data_set_and_process_reproduce_the_hashes::hashing_the_same_files_twice_gives_the_same_digest
  Scenario: Hashing the same files twice gives the same digest
    Given a fixture holding "corpus.json"
    When its basis is hashed twice
    Then both results are equal

  @test:schemas/test-run.test.ts::criterion_2_—_an_unchanged_data_set_and_process_reproduce_the_hashes::input_ORDER_does_not_change_the_hash,_but_input_SET_does
  Scenario: Input order does not change the hash, but the input set does
    Given a fixture holding "a.json" and "b.json"
    Then hashing them in either order gives the same hash
    And hashing "a.json" alone gives a different hash from both

  @test:schemas/test-run.test.ts::criterion_2_—_an_unchanged_data_set_and_process_reproduce_the_hashes::two_files_swapping_NAMES_is_a_different_basis
  Scenario: Two files swapping names is a different basis
    Given one fixture with "a.json" = "A" and "b.json" = "B", and another with the contents swapped
    When both are hashed over "a.json" and "b.json"
    Then the hashes differ

  @test:schemas/test-run.test.ts::criterion_2_—_an_unchanged_data_set_and_process_reproduce_the_hashes::an_unchanged_run_reproduces_on_both_halves
  Scenario: An unchanged run reproduces on both halves
    Given a fixture with one data and one process file
    When the same run is built twice
    Then data, process and both reproduce

  @test:schemas/test-run.test.ts::criterion_3_—_a_deliberate_change_to_either_is_detected::changing_the_DATA_moves_the_data_hash_and_only_the_data_hash
  Scenario: Changing the data moves only the data hash
    Given a run built over a fixture
    When the data file is rewritten and the run built again
    Then data does not reproduce, process does, and both does not

  @test:schemas/test-run.test.ts::criterion_3_—_a_deliberate_change_to_either_is_detected::changing_the_PROCESS_moves_the_process_hash_and_only_the_process_hash
  Scenario: Changing the process moves only the process hash
    Given a run built over a fixture
    When the process file is rewritten and the run built again
    Then data reproduces, process does not, and both does not

  @test:schemas/test-run.test.ts::`unknown`_is_a_third_state,_not_a_value_that_matches_itself::an_unreadable_input_yields_unknown_rather_than_a_hash_of_nothing
  Scenario: An unreadable input yields unknown rather than a hash of nothing
    Given an empty fixture
    When a basis over "missing.json" is hashed
    Then its hash is the unknown hash
    And its inputs still list "missing.json"

  @test:schemas/test-run.test.ts::`unknown`_is_a_third_state,_not_a_value_that_matches_itself::one_unreadable_input_makes_the_WHOLE_basis_unknown
  Scenario: One unreadable input makes the whole basis unknown
    Given a fixture holding "there.json" only
    When a basis over "there.json" and "missing.json" is hashed
    Then its hash is the unknown hash

  @test:schemas/test-run.test.ts::`unknown`_is_a_third_state,_not_a_value_that_matches_itself::unknown_does_not_reproduce_unknown
  Scenario: Unknown does not reproduce unknown
    Given a run whose data and process hashes are both unknown
    When it is compared with itself
    Then data, process and both are all false

  @test:schemas/test-run.test.ts::`unknown`_is_a_third_state,_not_a_value_that_matches_itself::a_real_hash_still_reproduces_itself_—_the_guard_is_not_simply_'never_equal'
  Scenario: A real hash still reproduces itself
    Given a run with real data and process hashes
    When it is compared with itself
    Then both reproduces

  @test:schemas/test-run.test.ts::the_schema_refuses_what_it_cannot_mean::a_basis_with_no_inputs_is_rejected_—_a_hash_over_nothing_is_not_a_hash
  Scenario: A basis with no inputs is rejected
    Given a run record whose data basis has no inputs
    When it is parsed
    Then it throws

  @test:schemas/test-run.test.ts::the_schema_refuses_what_it_cannot_mean::a_recorded_run,_written_and_read_back,_parses_as_what_it_declares
  Scenario: A recorded run written and read back parses as what it declares
    Given a freshly built run written to "s.test-run.json"
    When the file is read back and parsed
    Then its $schema is the test-run schema id
    And its data and process bases do not overlap

  @test:schemas/test-run.test.ts::a_run_may_name_the_plan_it_executed_and_the_system_under_test_(bean_ygzh)::a_run_recorded_before_plans_existed_still_parses,_with_neither_field
  Scenario: A run recorded before plans existed still parses with neither field
    Given a legacy crdm-detect run record with no plan and no system under test
    When it is parsed
    Then plan and sut are both absent

  @test:schemas/test-run.test.ts::a_run_may_name_the_plan_it_executed_and_the_system_under_test_(bean_ygzh)::plan_and_sut_are_carried_through_buildTestRun_and_parse
  Scenario: plan and sut are carried through buildTestRun and parse
    Given a run built with plan "crdm-detect" version "1" and an agent system under test
    When it is parsed
    Then the plan and sut come back unchanged

  @test:schemas/test-run.test.ts::a_run_may_name_the_plan_it_executed_and_the_system_under_test_(bean_ygzh)::a_plan_with_no_system_under_test_is_refused_—_a_plan_is_run_AGAINST_something
  Scenario: A plan with no system under test is refused
    Given a run naming a plan but no sut
    When it is parsed
    Then it fails
    And the first issue's path is "sut"

  @test:schemas/test-run.test.ts::a_run_may_name_the_plan_it_executed_and_the_system_under_test_(bean_ygzh)::reach_is_the_actor-reach_vocabulary_plus_`unknown`,_and_nothing_else
  Scenario: reach accepts unknown and refuses a value outside the vocabulary
    # Gap: only "unknown" (accepted) and "online" (refused) are tried, besides the fixture's "internet"
    Given a run with a plan and an agent sut
    When its reach is "unknown" it parses
    And when its reach is "online" it fails

  @test:schemas/test-run.test.ts::a_run_may_name_the_plan_it_executed_and_the_system_under_test_(bean_ygzh)::SC-002:_an_agent_run_without_a_model_or_a_configuration_is_refused
  Scenario: An agent run without a model or a configuration is refused
    Given a run with a plan and an agent sut naming model "claude-opus-5" and configuration "harness"
    Then it parses
    And without the model it fails
    And without the configuration it fails
    And with model "Claude Opus" it fails

  @test:schemas/test-run.test.ts::a_run_may_name_the_plan_it_executed_and_the_system_under_test_(bean_ygzh)::a_skill_names_no_model,_and_a_system_under_test_must_say_its_kind
  Scenario: A skill sut names no model, and every sut must say its kind
    Given a run with a plan and a skill sut "crdm-detect-signals" with reach "air-gapped"
    Then it parses
    And with a model added it fails
    And with its kind removed it fails

  @test:schemas/test-run.test.ts::a_run_may_name_the_plan_it_executed_and_the_system_under_test_(bean_ygzh)::the_plan_ref_carries_a_version,_because_a_case_id_means_nothing_across_plan_versions
  Scenario: A plan ref without a version is refused
    Given a run with an agent sut and a plan naming only id "p"
    When it is parsed
    Then it fails
