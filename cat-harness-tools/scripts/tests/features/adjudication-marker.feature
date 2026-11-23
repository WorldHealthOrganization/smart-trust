# The <cat-harness.processes:adjudication/> marker as the process-model loader
# (src/workflow/process-model.ts) reads it: who may adjudicate, its codes, a caller's
# accepts, a deferred enum, and the real adjudication diagrams. Each Scenario names the test that executes it.
Feature: The adjudication marker on process diagrams

  @test:scripts/tests/adjudication-marker.test.ts::a_mechanical_actor_may_not_adjudicate::REFUSES_an_adjudication_whose_step_a_`system`_actor_could_perform
  Scenario: An adjudication a system actor could perform is refused
    Given a task declaring codes "stands scope dispensation" and fulfilment kinds "person agent system"
    When the diagram is loaded
    Then loading fails with "Only `person` and `agent` may adjudicate"

  @test:scripts/tests/adjudication-marker.test.ts::a_mechanical_actor_may_not_adjudicate::REFUSES_`external`_too_—_outside_the_instance_is_not_an_adjudicator_here
  Scenario: An adjudication an external actor could perform is refused
    Given a task declaring the three codes and fulfilment kinds "person external"
    When the diagram is loaded
    Then loading fails with "Only `person` and `agent` may adjudicate"

  @test:scripts/tests/adjudication-marker.test.ts::a_mechanical_actor_may_not_adjudicate::REFUSES_an_adjudication_with_NO_fulfilment,_rather_than_defaulting_one
  Scenario: An adjudication with no fulfilment declaration is refused
    Given a task declaring the three codes and no fulfilment
    When the diagram is loaded
    Then loading fails saying there is no fulfilment element

  @test:scripts/tests/adjudication-marker.test.ts::a_mechanical_actor_may_not_adjudicate::accepts_`person_agent`_—_what_adjudication.bpmn's_judge_step_declares
  Scenario: An adjudication performed by person or agent is accepted
    Given a task declaring the three codes and fulfilment kinds "person agent" with a reason
    When the diagram is loaded
    Then the task's adjudication codes are "stands", "scope" and "dispensation"

  @test:scripts/tests/adjudication-marker.test.ts::the_codes_are_an_enum,_so_a_degenerate_one_is_refused::REFUSES_a_single_permitted_answer_—_assent_is_not_judgement
  Scenario: An adjudication with a single permitted answer is refused
    Given a judge declaring codes "approved"
    When the diagram is loaded
    Then loading fails with "at least two permitted answers"

  @test:scripts/tests/adjudication-marker.test.ts::the_codes_are_an_enum,_so_a_degenerate_one_is_refused::REFUSES_no_codes_at_all
  Scenario: An adjudication with no codes is refused
    Given a judge declaring an empty codes attribute
    When the diagram is loaded
    Then loading fails with "at least two permitted answers"

  @test:scripts/tests/adjudication-marker.test.ts::the_codes_are_an_enum,_so_a_degenerate_one_is_refused::REFUSES_a_repeated_code_—_the_outcome_could_not_say_which_was_chosen
  Scenario: An adjudication repeating a code is refused
    Given a judge declaring codes "a b a"
    When the diagram is loaded
    Then loading fails with "repeats a code"

  @test:scripts/tests/adjudication-marker.test.ts::the_codes_are_an_enum,_so_a_degenerate_one_is_refused::splits_on_any_whitespace,_so_a_newline-formatted_list_works
  Scenario: Adjudication codes split on any whitespace
    Given a judge declaring codes "stands" and "scope" separated by spaces and a newline
    When the diagram is loaded
    Then its codes are "stands" and "scope"

  @test:scripts/tests/adjudication-marker.test.ts::it_belongs_on_an_activity::REFUSES_the_marker_on_a_gateway_—_nobody_performs_a_gateway
  Scenario: The adjudication marker on a gateway is refused
    Given an exclusive gateway carrying the adjudication marker
    When the diagram is loaded
    Then loading fails with "only meaningful on an activity"

  @test:scripts/tests/adjudication-marker.test.ts::it_belongs_on_an_activity::works_on_a_userTask_as_well_as_a_task
  Scenario: The adjudication marker works on a userTask
    Given a userTask declaring the three codes and a person-or-agent fulfilment
    When the diagram is loaded
    Then its adjudication has 3 codes

  @test:scripts/tests/adjudication-marker.test.ts::the_declared_codes_and_the_gateway's_branches_are_ONE_fact::accepts_the_matching_case
  Scenario: A gateway whose branches match the declared codes is accepted
    Given a judge declaring codes "a b" feeding a gateway with branches coded "a" and "b"
    When the diagram is loaded
    Then the judge's codes are "a" and "b"

  @test:scripts/tests/adjudication-marker.test.ts::the_declared_codes_and_the_gateway's_branches_are_ONE_fact::REFUSES_a_branch_naming_a_code_the_judge_does_not_permit
  Scenario: A branch naming a code the judge does not permit is refused
    Given a judge declaring codes "a b" and branches coded "a" and "c"
    When the diagram is loaded
    Then loading fails with "must be the same set"

  @test:scripts/tests/adjudication-marker.test.ts::the_declared_codes_and_the_gateway's_branches_are_ONE_fact::REFUSES_a_declared_code_no_branch_acts_on
  Scenario: A declared code no branch acts on is refused
    Given a judge declaring codes "a b c" and branches coded "a" and "b"
    When the diagram is loaded
    Then loading fails with "must be the same set"

  @test:scripts/tests/adjudication-marker.test.ts::the_declared_codes_and_the_gateway's_branches_are_ONE_fact::REFUSES_a_PARTLY_coded_gateway_—_it_reads_as_complete
  Scenario: A partly coded gateway is refused
    Given a judge declaring codes "a b" and branches coded "a", "b" and one uncoded
    When the diagram is loaded
    Then loading fails with "partly-coded gateway"

  @test:scripts/tests/adjudication-marker.test.ts::the_declared_codes_and_the_gateway's_branches_are_ONE_fact::a_gateway_that_codes_NOTHING_opts_out_rather_than_failing
  Scenario: A gateway that codes no branch opts out
    Given a judge declaring codes "a b" and two uncoded branches
    When the diagram is loaded
    Then it loads and the judge's codes are "a" and "b"

  @test:scripts/tests/adjudication-marker.test.ts::the_declared_codes_and_the_gateway's_branches_are_ONE_fact::ORDER_does_not_matter_—_a_set,_not_a_sequence
  Scenario: Declared codes and branch codes compare as sets
    Given a judge declaring codes "b a" and branches coded "a" and "b"
    When the diagram is loaded
    Then the judge's adjudication is defined

  @test:scripts/tests/adjudication-marker.test.ts::absence_stays_absence::an_activity_with_no_marker_has_no_adjudication,_and_still_loads
  Scenario: An activity with no adjudication marker has none and still loads
    Given a task naming only a skill
    When the diagram is loaded
    Then its adjudication is undefined

  @test:scripts/tests/adjudication-marker.test.ts::absence_stays_absence::the_real_corpus_still_loads,_adjudication.bpmn_included
  Scenario: Every diagram of the real process corpus loads
    Given the harness's declared process diagrams, more than 5 of them
    When each is loaded
    Then none fails to load

  @test:scripts/tests/adjudication-marker.test.ts::a_caller_says_what_it_can_act_on,_and_it_is_checked::accepts_the_matching_case,_and_the_list_is_on_the_node
  Scenario: A caller accepting exactly the judge's answers is accepted
    Given a call activity accepting "a b" into a child whose judge declares codes "a b"
    When the diagram is loaded
    Then the call's accepted answers are "a" and "b"

  @test:scripts/tests/adjudication-marker.test.ts::a_caller_says_what_it_can_act_on,_and_it_is_checked::ORDER_does_not_matter_—_a_set,_as_on_the_judge_side
  Scenario: A caller's accepted answers compare as a set
    Given a call activity accepting "b a" into a child whose judge declares codes "a b"
    When the diagram is loaded
    Then the call's accepted answers are "b" and "a"

  @test:scripts/tests/adjudication-marker.test.ts::a_caller_says_what_it_can_act_on,_and_it_is_checked::REFUSES_a_caller_accepting_an_answer_the_judge_cannot_give
  Scenario: A caller accepting an answer the judge cannot give is refused
    Given a call activity accepting "a c" into a child whose judge declares codes "a b"
    When the diagram is loaded
    Then loading fails saying it accepts (a, c) but Process_Child's A_C may answer (a, b)

  @test:scripts/tests/adjudication-marker.test.ts::a_caller_says_what_it_can_act_on,_and_it_is_checked::REFUSES_a_strict_SUBSET_—_the_unaccepted_answers_still_arrive
  Scenario: A caller accepting a strict subset of the judge's answers is refused
    Given a call activity accepting "a b" into a child whose judge declares codes "a b c"
    When the diagram is loaded
    Then loading fails saying the judge may answer (a, b, c)

  @test:scripts/tests/adjudication-marker.test.ts::a_caller_says_what_it_can_act_on,_and_it_is_checked::REFUSES_`accepts`_on_a_call_into_a_process_that_adjudicates_nothing
  Scenario: Accepts on a call into a process with no judgement is refused
    Given a call activity accepting "a b" into a child with no adjudication
    When the diagram is loaded
    Then loading fails with "contains no judgement"

  @test:scripts/tests/adjudication-marker.test.ts::a_caller_says_what_it_can_act_on,_and_it_is_checked::REFUSES_`accepts`_anywhere_but_a_call_activity
  Scenario: Accepts on anything but a call activity is refused
    Given a plain task declaring accepts "a b"
    When the diagram is loaded
    Then loading fails with "only meaningful on a call activity"

  @test:scripts/tests/adjudication-marker.test.ts::a_caller_says_what_it_can_act_on,_and_it_is_checked::REFUSES_declaring_both_`codes`_and_`accepts`_—_it_cannot_be_both
  Scenario: Declaring both codes and accepts is refused
    Given a call activity declaring both codes "a b" and accepts "a b"
    When the diagram is loaded
    Then loading fails with "declares both"

  @test:scripts/tests/adjudication-marker.test.ts::a_caller_says_what_it_can_act_on,_and_it_is_checked::REFUSES_a_single_accepted_answer
  Scenario: A caller accepting a single answer is refused
    Given a call activity accepting "a"
    When the diagram is loaded
    Then loading fails with "names 1 code"

  @test:scripts/tests/adjudication-marker.test.ts::a_caller_says_what_it_can_act_on,_and_it_is_checked::a_caller_declaring_NOTHING_loads_—_absence_is_reported,_not_refused
  Scenario: A caller declaring no accepts still loads
    # Gap: that the absence is reported by check:workflow-refs is not checked
    Given a call activity naming only a skill, into a child with a judge
    When the diagram is loaded
    Then the call's accepted answers are undefined
    And the called child process is loaded

  @test:scripts/tests/adjudication-marker.test.ts::a_misspelled_attribute_is_refused,_not_ignored::REFUSES_an_attribute_the_engine_does_not_read
  Scenario: An adjudication attribute the engine does not read is refused
    Given a call activity carrying attribute "accept" on the adjudication marker
    When the diagram is loaded
    Then loading fails saying it carries "accept", which the engine does not read

  @test:scripts/tests/adjudication-marker.test.ts::a_misspelled_attribute_is_refused,_not_ignored::REFUSES_a_judge_whose_codes_are_misspelled_into_nothing
  Scenario: A judge whose codes attribute is misspelled is refused
    Given a judge carrying attribute "code" instead of "codes"
    When the diagram is loaded
    Then loading fails saying it carries "code"

  @test:scripts/tests/adjudication-marker.test.ts::the_two_real_callers_that_fit::review-narrative_and_voice-review_declare_the_three,_and_they_match
  Scenario: review-narrative and voice-review accept the three criterion outcomes
    Given the real diagrams review-narrative.bpmn and voice-review.bpmn
    When each is loaded
    Then "Task_AdjudicateVoice" and "Task_Adjudicate" respectively accept "stands", "scope" and "dispensation"

  @test:scripts/tests/adjudication-marker.test.ts::the_two_real_callers_that_fit::sample-import_and_subscribe-kg_declare_the_four_for_refresh-materialized
  Scenario: sample-import and subscribe-kg accept the four refresh outcomes
    Given the real diagrams sample-import.bpmn and subscribe-kg.bpmn
    When each is loaded
    Then each one's "Call_Refresh" accepts "remote", "local", "merge" and "defer"

  @test:scripts/tests/adjudication-marker.test.ts::`defers="caller"`_—_an_adjudication_whose_enum_the_caller_owns::the_deferral_is_DECLARED,_so_it_cannot_be_confused_with_a_lost_marker
  Scenario: A deferred enum is declared, not read as a lost marker
    Given a parent calling a child whose judge declares defers "caller"
    When the diagram is loaded
    Then the child's judge is marked as deferring
    And it has no adjudication codes

  @test:scripts/tests/adjudication-marker.test.ts::`defers="caller"`_—_an_adjudication_whose_enum_the_caller_owns::it_still_carries_the_actor_restriction_—_a_`system`_actor_may_not
  Scenario: A deferring adjudication still refuses a system actor
    Given a task declaring defers "caller" and fulfilment kinds "person system"
    When the diagram is loaded
    Then loading fails with "Only `person` and `agent` may adjudicate"

  @test:scripts/tests/adjudication-marker.test.ts::`defers="caller"`_—_an_adjudication_whose_enum_the_caller_owns::REFUSES_a_deferral_with_no_fulfilment_at_all
  Scenario: A deferring adjudication with no fulfilment is refused
    Given a task declaring defers "caller" and no fulfilment
    When the diagram is loaded
    Then loading fails saying there is no fulfilment element

  @test:scripts/tests/adjudication-marker.test.ts::`defers="caller"`_—_an_adjudication_whose_enum_the_caller_owns::REFUSES_any_value_but_`caller`_—_there_is_nowhere_else_an_enum_comes_from
  Scenario: A deferral to anything but the caller is refused
    Given a task declaring defers "somewhere"
    When the diagram is loaded
    Then loading fails with "The only value is `caller`"

  @test:scripts/tests/adjudication-marker.test.ts::`defers="caller"`_—_an_adjudication_whose_enum_the_caller_owns::REFUSES_`accepts`_against_a_deferring_adjudicator,_and_says_to_use_`codes`
  Scenario: Accepts against a deferring adjudicator is refused with advice to declare codes
    Given a call activity accepting "a b" into a child whose judge defers its enum
    When the diagram is loaded
    Then loading fails saying the judge defers its enum to the caller and to declare codes instead

  @test:scripts/tests/adjudication-marker.test.ts::`defers="caller"`_—_an_adjudication_whose_enum_the_caller_owns::a_caller_declaring_nothing_still_loads_—_the_four_real_ones_do
  Scenario: A caller of a deferring adjudicator declaring nothing still loads
    # Gap: only a fixture caller is checked, not the four real callers
    Given a call activity naming only a skill, into a child whose judge defers its enum
    When the diagram is loaded
    Then the call has no adjudication codes
    And it has no accepted answers

  @test:scripts/tests/adjudication-marker.test.ts::the_split_—_bean_`bvuk`,_the_owner's_shape::Process_Adjudication_ends_AT_the_judgement_and_names_no_outcomes
  Scenario: Process_Adjudication ends at the judgement and names no outcomes
    Given the real adjudication.bpmn
    When it is loaded
    Then "A_Adjudicate" defers its enum
    And "GW_Outcome", "A_ScopeCriterion", "A_Dispensation" and "A_RecordEntry" are absent

  @test:scripts/tests/adjudication-marker.test.ts::the_split_—_bean_`bvuk`,_the_owner's_shape::what_must_NOT_vary_stayed:_entry_condition,_dispatch,_actor_kinds
  Scenario: Process_Adjudication keeps its entry condition, dispatch and actor kinds
    Given the real adjudication.bpmn
    When it is loaded
    Then "GW_Adjudicable" exists
    And "A_Dispatch" names skill "untainted-verification"
    And "A_Adjudicate" may be fulfilled by "agent" and "person"

  @test:scripts/tests/adjudication-marker.test.ts::the_split_—_bean_`bvuk`,_the_owner's_shape::criterion-adjudication_owns_the_three_outcomes_and_declares_the_enum
  Scenario: criterion-adjudication owns the three outcomes and declares the enum
    Given the real criterion-adjudication.bpmn
    When it is loaded
    Then "Call_Adjudicate" declares codes "dispensation", "scope" and "stands"
    And "A_RecordEntry" and "A_Dispensation" are not relaxable

  @test:scripts/tests/adjudication-marker.test.ts::the_split_—_bean_`bvuk`,_the_owner's_shape::the_criterion_callers_call_the_specialisation,_not_the_shared_half
  Scenario: The criterion callers call the criterion specialisation
    Given the real diagrams review-narrative.bpmn, voice-review.bpmn and wireframe-design-review.bpmn
    When each is loaded
    Then "Task_AdjudicateVoice", "Task_Adjudicate" and "Call_Adjudicate" respectively call "Process_CriterionAdjudication"
