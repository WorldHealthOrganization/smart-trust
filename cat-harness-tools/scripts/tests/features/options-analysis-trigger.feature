# Process_OptionsAnalysis has a way to stop (bean u4hs): A_Frame leads to a
# trigger gateway whose no outcome ends the process early. Each Scenario names
# the test that executes it.
Feature: The options analysis trigger gateway

  @test:scripts/tests/options-analysis-trigger.test.ts::the_trigger_gateway::A_Frame_leads_to_the_GATEWAY,_not_straight_to_A_Select
  Scenario: A_Frame leads to the gateway, not straight to A_Select
    Given an instance of the options analysis process
    When A_Frame is completed
    Then only GW_Trigger is enabled

  @test:scripts/tests/options-analysis-trigger.test.ts::the_trigger_gateway::`no`_reaches_a_DISTINCT_end_event_and_never_touches_A_Select
  Scenario: The no outcome ends the process without touching A_Select
    When A_Frame is completed and GW_Trigger is completed with "no"
    Then no token is on A_Select or A_Record and nothing is enabled

  @test:scripts/tests/options-analysis-trigger.test.ts::the_trigger_gateway::`yes`_still_runs_the_whole_analysis,_in_order
  Scenario: The yes outcome runs the whole analysis in order
    When A_Frame is completed and GW_Trigger is completed with "yes"
    Then A_Select, A_CheckEvidence, A_Apply and A_Record are each the only enabled step in turn
    And after A_Record nothing is enabled

  @test:scripts/tests/options-analysis-trigger.test.ts::the_trigger_gateway::the_two_outcomes_are_DIFFERENT_end_events
  Scenario: The two outcomes are different end events
    When the process model's end events are listed
    Then they are End_Process_OptionsAnalysis and End_TriggerNotMet

  @test:scripts/tests/options-analysis-trigger.test.ts::the_trigger_gateway::the_gateway_is_NOT_dmn-backed,_because_the_question_is_judged
  Scenario: The gateway is a judged decision, not DMN-backed
    When A_Frame is completed
    Then the enabled GW_Trigger is a decision offering the outcomes no and yes
