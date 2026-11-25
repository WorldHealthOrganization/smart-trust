# src/workflow/instance.ts walks a BPMN process instance: the context each enabled
# task carries (role, skills, conventions, beans), the Tool activities kept on the
# step that did them, and their link to the step. Each Scenario names the test that executes it.
Feature: Process instance walk, task context and step activities

  @test:src/workflow/instance.test.ts::PROCESS_WALK:_deterministic_task_context_from_the_KG_(folio-assistant-3q47)::entering_and_leaving_a_subprocess_overlays_and_REMOVES_context;_assert_overlay_is_cleanly_gone_after_child_completes
  Scenario: Entering a subprocess overlays its context and leaving it removes the overlay
    Given a parent process whose editor lane runs Task_Before, a call to a reviewer child process, then Task_After
    And an instance started carrying beans "bean-alpha" and "bean-beta"
    When the enabled steps are read at Task_Before
    Then one step is enabled, Task_Before, under role "editor" with role stack "editor"
    And its skills are the editor's two skills plus "task-before-skill"
    And its conventions are "conv-parent-global", "conv-parent-lane" and "conv-task-before", with no child convention or reviewer skill
    When Task_Before is completed
    Then the one enabled step is Task_Child_1 under role "reviewer" with role stack "editor", "reviewer"
    And its skills are "child-step1-skill" plus the editor's and reviewer's skills
    And its conventions include the parent's, the call activity's and the child's process, lane and task conventions
    And its carried beans are "bean-alpha", "bean-beta", "bean-call-level" and "bean-child-step1"
    When Task_Child_1 is completed
    Then the one enabled step is Task_Child_2 with role stack "editor", "reviewer"
    When Task_Child_2 is completed
    Then the one enabled step is Task_After under role "editor" with role stack "editor"
    And its skills are exactly the editor's two skills plus "task-after-skill", with no reviewer or child skill
    And its conventions are exactly "conv-parent-global", "conv-parent-lane" and "conv-task-after", with no call or child convention
    When Task_After is completed
    Then the instance is completed

  @test:src/workflow/instance.test.ts::PROCESS_WALK:_deterministic_task_context_from_the_KG_(folio-assistant-3q47)::two_runs_at_the_same_task_under_the_same_role_produce_identical_deterministic_context
  Scenario: Two runs at the same task under the same role produce identical context
    Given two instances of the parent process with different ids, the same subject, bean and carried beans
    When each completes Task_Before and its enabled step is read
    Then both steps are the same node with identical context, field by field and as serialized JSON
    And the context role is "reviewer" with role stack "editor", "reviewer"

  @test:src/workflow/instance.test.ts::PROCESS_WALK:_deterministic_task_context_from_the_KG_(folio-assistant-3q47)::the_bean(s)_carried_at_a_task_are_part_of_that_context
  Scenario: The beans carried at a task are part of its context
    Given an instance with bean "folio-assistant-3q47" carrying "bean-z-last" and "bean-a-first"
    When the enabled step at Task_Before is read
    Then its carried beans are "bean-a-first", "bean-z-last" and "folio-assistant-3q47", sorted
    When Task_Before is completed adding carried bean "bean-runtime-added"
    Then the child step's carried beans add "bean-call-level", "bean-child-step1" and "bean-runtime-added", sorted
    When both child steps are completed
    Then the step at Task_After still carries "folio-assistant-3q47", "bean-runtime-added" and "bean-child-step1"

  @test:src/workflow/instance.test.ts::Tool_activities_are_kept_on_the_step_that_did_them_(folio-assistant#875_FR-005,_owner_option_A)::an_activity_naming_this_step_is_recorded_on_its_history_entry
  Scenario: An activity naming this step is recorded on its history entry
    Given a started instance of the parent process
    When Task_Before is completed with one prov:Activity whose plan is "parent#Task_Before"
    Then the Task_Before history entry holds that one activity
    And its generated entity is "skills/x.md@sha256:bbbb"

  @test:src/workflow/instance.test.ts::Tool_activities_are_kept_on_the_step_that_did_them_(folio-assistant#875_FR-005,_owner_option_A)::no_activities,_no_field:_nothing_is_invented
  Scenario: A step completed with no activities records no activities field
    Given a started instance of the parent process
    When Task_Before is completed with no activities
    Then its history entry has no activities field

  @test:src/workflow/instance.test.ts::Tool_activities_are_kept_on_the_step_that_did_them_(folio-assistant#875_FR-005,_owner_option_A)::an_activity_done_for_another_step_refuses,_and_the_step_is_not_recorded
  Scenario: An activity done for another step refuses, and the step is not recorded
    Given a started instance of the parent process
    When Task_Before is completed with an activity whose plan is "parent#Task_After"
    Then a workflow error is thrown
    And no history entry for Task_Before is recorded
    And the token still sits on Task_Before

  @test:src/workflow/instance.test.ts::Tool_activities_are_kept_on_the_step_that_did_them_(folio-assistant#875_FR-005,_owner_option_A)::a_step_with_no_prov_activity_of_its_own:_no_prov:wasInformedBy_is_invented_(bean_w1gy)
  Scenario: A step with no prov activity of its own gets no prov:wasInformedBy
    Given a started instance of the parent process
    When Task_Before is completed with an activity whose plan is "parent#Task_Before"
    Then the history entry has no prov activity of its own
    And the recorded activity has no "prov:wasInformedBy"

  @test:src/workflow/instance.test.ts::Tool_activities_are_kept_on_the_step_that_did_them_(folio-assistant#875_FR-005,_owner_option_A)::something_that_is_not_a_prov:Activity_refuses
  Scenario: Something that is not a prov:Activity refuses
    Given a started instance of the parent process
    When Task_Before is completed with an activity that is just a note
    Then a workflow error is thrown

  @test:src/workflow/instance.test.ts::informedByStep_—_a_Tool_activity_is_linked_to_its_step's_prov:Activity_(bean_w1gy,_folio-assistant#875_FR-005)::the_step's_@id_is_written_when_the_step_has_its_own_activity
  Scenario: The step's @id is written when the step has its own activity
    Given a Tool activity and a step activity with @id "inst#0"
    When the Tool activity is linked to the step
    Then its "prov:wasInformedBy" is "inst#0"

  @test:src/workflow/instance.test.ts::informedByStep_—_a_Tool_activity_is_linked_to_its_step's_prov:Activity_(bean_w1gy,_folio-assistant#875_FR-005)::no_step_activity,_or_one_without_an_@id:_nothing_is_added
  Scenario: No step activity, or one without an @id, adds nothing
    Given a Tool activity
    When it is linked to no step activity
    Then it has no "prov:wasInformedBy"
    And when it is linked to a step activity with an empty @id, it has none either

  @test:src/workflow/instance.test.ts::informedByStep_—_a_Tool_activity_is_linked_to_its_step's_prov:Activity_(bean_w1gy,_folio-assistant#875_FR-005)::a_value_the_Tool_supplied_is_kept,_the_step's_added_beside_it
  Scenario: A value the Tool supplied is kept and the step's is added beside it
    Given a step activity with @id "inst#0"
    When a Tool activity informed by "other#1" is linked
    Then it is informed by "other#1" and "inst#0"
    And a Tool activity informed by "a#1" and "b#2" becomes informed by "a#1", "b#2" and "inst#0"
    And a Tool activity already informed by "inst#0" stays informed by just "inst#0"

  @test:src/workflow/instance.test.ts::informedByStep_—_a_Tool_activity_is_linked_to_its_step's_prov:Activity_(bean_w1gy,_folio-assistant#875_FR-005)::a_hash-sealed_Tool_activity_is_left_as_it_was
  Scenario: A hash-sealed Tool activity is left as it was
    Given a Tool activity carrying a record hash
    When it is linked to the step activity "inst#0"
    Then the very same activity object is returned
