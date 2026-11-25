# check:process-bindings, seen failing on planted violations: a process may
# bind only skills, roles and processes held in its own instance or one it
# needs; a wrong-direction binding not in the baseline is a regression.
Feature: check:process-bindings judges each binding's direction and ratchets the baseline

  @test:scripts/tests/process/check-process-bindings.test.ts::judgeBinding::a_skill_in_the_process's_own_instance_is_allowed
  Scenario: A skill held in the process's own instance is allowed
    Given instances harness, core (needs harness) and smart (needs core)
    When a core binding to a skill held in core is judged
    Then the verdict is "allowed"

  @test:scripts/tests/process/check-process-bindings.test.ts::judgeBinding::a_skill_in_an_instance_it_needs,_transitively,_is_allowed
  Scenario: A skill held in a transitively needed instance is allowed
    Given the same instances
    When a smart binding to a skill held in harness is judged
    Then the verdict is "allowed"

  @test:scripts/tests/process/check-process-bindings.test.ts::judgeBinding::a_skill_only_in_an_instance_ABOVE_it_is_wrong-direction_—_the_l3-fhir-pipeline_case
  Scenario: A skill held only above the process's instance is wrong-direction
    Given the same instances
    When a harness binding to a skill held in core, and a core binding to a skill held in smart, are judged
    Then each verdict is "wrong-direction"

  @test:scripts/tests/process/check-process-bindings.test.ts::judgeBinding::one_reachable_holder_is_enough_when_a_name_is_held_in_several_instances
  Scenario: One reachable holder among several is enough
    Given the same instances
    When a core binding to a skill held in smart and in harness is judged
    Then the verdict is "allowed"

  @test:scripts/tests/process/check-process-bindings.test.ts::judgeBinding::a_skill_nobody_holds_is_dangling,_not_wrong-direction
  Scenario: A skill nobody holds is dangling
    Given the same instances
    When a core binding to a skill no instance holds is judged
    Then the verdict is "dangling"

  @test:scripts/tests/process/check-process-bindings.test.ts::judgeBinding::an_instance_with_no_declared_needs_is_undetermined,_never_folded_into_allowed
  Scenario: An instance with no declared needs is undetermined
    Given the same instances, and an instance "floor" with no declared needs
    When a floor binding to a skill held in harness is judged
    Then the verdict is "undetermined"

  @test:scripts/tests/process/check-process-bindings.test.ts::activityRefs::attributes_each_skill_ref_to_the_activity_that_carries_it
  Scenario: Each skill ref is attributed to its activity
    Given a process with a task carrying skill "one" and a user task carrying skill "pkg/two"
    When its activity refs are read
    Then they are Task_A → "one" and Task_B → "pkg/two"

  @test:scripts/tests/process/check-process-bindings.test.ts::activityRefs::a_qualified_ref_denotes_the_bare_skill_name
  Scenario: A qualified skill ref denotes the bare name
    Given the refs "pkg/two" and "two"
    When their skill names are taken
    Then each is "two"

  @test:scripts/tests/process/check-process-bindings.test.ts::residual.py's_other_four_joins_(f8wp)::callActivityRefs_extracts_calledElement_per_callActivity,_and_processIdsIn_finds_processes_and_globalTasks
  Scenario: Call activities' called elements, and process and global-task ids, are read
    Given definitions holding a global task GT_Shared and a process Proc_Main with two call activities
    When the process ids and call-activity refs are read
    Then the ids are GT_Shared and Proc_Main
    And the refs are Call_Sub → Proc_Higher and Call_Global → GT_Shared

  @test:scripts/tests/process/check-process-bindings.test.ts::residual.py's_other_four_joins_(f8wp)::laneRoleRefs_extracts_partitionElementRef_and_extension_role_refs_without_double-counting
  Scenario: Lane role refs are read once per lane from either spelling
    Given a lane with partitionElementRef and an extension ref both "role:reviewer", and a lane with only an extension ref "clinical-sme"
    When the lane role refs are read
    Then "role:reviewer" names the role "reviewer"
    And the refs are exactly Lane_1 → reviewer and Lane_2 → clinical-sme

  @test:scripts/tests/process/check-process-bindings.test.ts::residual.py's_other_four_joins_(f8wp)::roleSkillRefs_and_actorRoleRefs_extract_role→skill_and_actor→role_edges
  Scenario: Role → skill and actor → role edges are read
    Given a role graph with role qc-reviewer and an extension of build-pipeline, and an actor authoring-agent with two roles
    When the role-skill and actor-role refs are read
    Then each role skill is an edge from its role, the extension's from "ext:build-pipeline"
    And each actor role is an edge from authoring-agent

  @test:scripts/tests/process/check-process-bindings.test.ts::residual.py's_other_four_joins_(f8wp)::analyse_catches_planted_upward_references_across_all_five_joins_in_a_two-instance_fixture
  Scenario: analyse finds a planted upward reference in each of the five joins
    Given a git checkout with instance "lower" and instance "upper" that needs it
    And lower's process, roles and actor each refer to an upper skill, role or process
    When the checkout is analysed
    Then the wrong-direction findings are exactly one activity-skill, actor-role, call-activity, lane-role and role-skill reference into upper

  @test:scripts/tests/process/check-process-bindings.test.ts::the_ratchet::a_wrong-direction_binding_with_no_baseline_entry_is_a_regression
  Scenario: An unbaselined wrong-direction binding is a regression
    Given a wrong-direction binding and an empty baseline
    When the ratchet is applied
    Then there is one regression

  @test:scripts/tests/process/check-process-bindings.test.ts::the_ratchet::a_baselined_one_passes
  Scenario: A baselined wrong-direction binding passes
    Given a wrong-direction binding and a baseline entry for it
    When the ratchet is applied
    Then there are no regressions and no stale entries

  @test:scripts/tests/process/check-process-bindings.test.ts::the_ratchet::a_cleared_one_leaves_the_baseline_STALE,_so_the_head-room_cannot_be_reused
  Scenario: A baseline entry with no binding left is stale
    Given no bindings and a baseline entry
    When the ratchet is applied
    Then there is one stale entry

  @test:scripts/tests/process/check-process-bindings.test.ts::the_ratchet::allowed_and_dangling_bindings_are_never_regressions
  Scenario: Allowed and dangling bindings are not regressions
    Given an allowed and a dangling binding and an empty baseline
    When the ratchet is applied
    Then there are no regressions

  @test:scripts/tests/process/check-process-bindings.test.ts::the_ratchet::every_baseline_entry_carries_a_reason_and_a_bean
  Scenario: Every committed baseline entry has a reason and a bean
    Given the committed process-bindings baseline
    When each entry is read
    Then its reason is longer than 20 characters
    And its bean matches folio-assistant-<4 characters>
