# The workflow view's join and its stuck-state classifier
# (bean folio-assistant-v49e), against hand-built instances, beans and todos.
# Each Scenario names the test that executes it.
Feature: Workflow view

  Background:
    Given "now" is 2026-10-24, and a running instance of Process_P with a token on Task_A, last moved a day ago, carrying bean "x-1"

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::the_threshold_is_a_named_week
  Scenario: The stuck threshold is a week
    Then the stuck threshold is 7 days

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::a_fresh_running_instance_is_in_none
  Scenario: A fresh running instance is not stuck
    Then the instance has no stuck states

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::a_token_unmoved_past_the_threshold_is_enabled-not-taken,_and_just_inside_it_is_not
  Scenario: A token unmoved past a week is enabled-not-taken
    Then an instance and bean last updated 8 days ago are "enabled-not-taken"
    And one updated 6 days ago has no stuck states

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::with_no_updatedAt_the_newest_dated_history_entry_is_when_it_last_moved
  Scenario: Without updatedAt the newest history entry dates the last move
    Given no updatedAt and history entries 30 and 20 days ago
    Then it last moved 20 days ago and is "enabled-not-taken"

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::no_date_anywhere_is_age-unknown,_never_fresh
  Scenario: No date at all is age-unknown
    Given no updatedAt and no history
    Then the instance is "age-unknown"

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::the_bean_updated_well_after_the_instance_last_moved_is_bean-moved-on
  Scenario: A bean updated long after the instance moved has moved on
    Then an instance and bean both updated 3 days ago are not stuck
    And an instance unmoved for 20 days whose bean updated yesterday is "enabled-not-taken" and "bean-moved-on"

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::a_block_with_no_expiry_on_the_instance's_bean_is_blocked-without-expiry,_in_each_of_its_three_shapes
  Scenario: A block with no expiry, in three shapes
    Then a bean with a "Blocked on" section without "expires" is "blocked-without-expiry"
    And with "expires" it is not stuck
    And a bean saying "blocked" in prose, and one declared blocked by another bean, are "blocked-without-expiry"

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::a_closed_bean_under_a_running_instance_is_bean-closed
  Scenario: A closed bean under a running instance
    Then a running instance whose bean is completed is "bean-closed"

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::running_with_no_token_anywhere_is_no-token;_a_token_in_a_running_child_counts
  Scenario: Running with no token
    Then a running instance with no tokens is "no-token"
    And one whose only token is in a running child is not stuck

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::no_status_is_said;_a_token_resting_on_an_end_event_is_finished,_not_waiting
  Scenario: No status, and a token on an end event
    Given an instance with no status, a token on "End_Done" and 40 days unmoved
    Then knowing "End_Done" is an end event, it is only "no-status", with a detail naming "end event"
    And without the end events it is "no-status" and "enabled-not-taken"

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::a_completed_instance_is_in_none
  Scenario: A completed instance is not stuck
    Then a completed instance unmoved for 100 days with a completed bean is not stuck

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::a_refusal_after_the_instance_last_moved_is_a_refused_gate;_one_before_it_is_history
  Scenario: A refusal after the last move is a refused gate
    Given refusals 3 days ago and 1 day ago, and the instance moved 2 days ago
    Then it is "refused-gate", with a detail saying "refused 1 step(s)" and naming Task_B, the actor and the reason
    And an instance whose only refusal predates its last move is not stuck

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::an_instance_with_no_refusals_field_says_not_recorded,_never_'never_refused'
  Scenario: Gate refusals are recorded since a stated date
    # Gap: checks only the GATE_REFUSALS constant (since 2026-10-29, "not recorded"); no instance without a refusals field is classified or rendered.
    Then gate refusals are recorded since "2026-10-29" and their note says "not recorded"

  @test:scripts/tests/workflow-view.test.ts::stuck_states_are_states,_from_committed_data_and_a_given_now::withRefusal_keeps_the_newest,_folds_the_reason_to_one_line,_and_moves_nothing
  Scenario: Recording refusals keeps the newest and moves nothing
    When more refusals than are kept are recorded, each with a two-line reason
    Then only the kept number remain, the last is the newest, and the reason is folded to one line
    And the instance's updatedAt and tokens are unchanged

  @test:scripts/tests/workflow-view.test.ts::the_join:_position,_beans,_todos::every_bean_gets_one_of_three_positions,_and_none_is_a_stated_reason
  Scenario: Every bean gets a position
    Given beans x-1, x-2 and x-3, a running instance for x-1, a completed one for x-2, and one carrying x-1
    Then x-1 is "running" in two instances, x-2 "finished", and x-3 "none" with the stated reason

  @test:scripts/tests/workflow-view.test.ts::the_join:_position,_beans,_todos::todos_are_named_by_process,_by_step,_or_by_a_bean_the_instance_names
  Scenario: Todos named by process, step or bean
    Given an instance with a running child on Process_C
    Then a todo tagged Process_P, one tagged with step Process_C▸Task_C, and one referencing bean x-1 are named, each with its reason
    And a todo tagged with another process and referencing a skill is not

  @test:scripts/tests/workflow-view.test.ts::the_join:_position,_beans,_todos::diagram_levels_follow_a_token_into_its_running_subprocess
  Scenario: Diagram levels follow a token into a subprocess
    Given a token on Call_C with a running child whose token is on Task_C
    Then the levels are Process_P with token Call_C and done Start, then Process_C under Call_C with token Task_C and done Start_C

  @test:scripts/tests/workflow-view.test.ts::the_join:_position,_beans,_todos::bean_steps_are_read_off_the_model_and_its_subprocesses;_end_nodes_too
  Scenario: Bean steps and end nodes come from the model
    Given a model with a claim activity, a plain task, an end node, and a subprocess holding a resolve activity
    Then the bean steps are claim at A_Claim and resolve at Call_Close▸A_Close
    And the end nodes are End, and no model has none

  @test:scripts/tests/workflow-view.test.ts::the_join:_position,_beans,_todos::an_unreadable_or_foreign_file_is_listed_with_its_reason,_never_dropped
  Scenario: Unreadable and foreign instance files are listed with reasons
    Given a valid instance file, a file of broken JSON, and one with  "other/v1"
    Then the first reads as instance "a", the second as "not readable JSON", and the third names "other/v1"

  @test:scripts/tests/workflow-view.test.ts::the_process_→_instance_join_the_processes_viewer_links_by::an_instance_counts_for_its_own_process_and_every_subprocess_in_its_children,_completed_ones_included
  Scenario: An instance counts for every process in its tree
    Given an instance with a child on Process_C and a completed grandchild on Process_G
    Then its process ids are Process_C, Process_G and Process_P

  @test:scripts/tests/workflow-view.test.ts::the_process_→_instance_join_the_processes_viewer_links_by::links_group_by_process,_sorted_by_store_then_id,_and_a_process_twice_in_one_instance_is_listed_once
  Scenario: Instance links grouped by process
    Given three instance links across two stores, one naming Process_C twice
    Then Process_P lists s1/z then s2/b, Process_C lists s1/a then s1/z once, and Process_Q has none

  @test:scripts/tests/workflow-view.test.ts::the_working_context_at_the_token_(item_3)::inherits_is_closed_over,_nearest_first,_each_role_once
  Scenario: Role inheritance is closed over
    Then "reviewer" inheriting "contributor" closes to reviewer, contributor
    And with no role graph it is just "reviewer"

  @test:scripts/tests/workflow-view.test.ts::the_working_context_at_the_token_(item_3)::the_step's_role,_its_skills,_and_the_memory_its_role_and_inherited_roles_reach
  Scenario: The working context at the token
    Given a diagram whose Task_A in the Reviewer lane names skill "step-skill", and memory for reviewers, contributors, publishers, everyone and an archived one
    When the working context of a token on Task_A is taken
    Then the node is Task_A, the role "reviewer", memory roles reviewer and contributor
    And the skills are review, step-skill and write
    And the role memory is "for-reviewers" and "inherited", with 1 memory for everyone

  @test:scripts/tests/workflow-view.test.ts::the_working_context_at_the_token_(item_3)::no_role_graph:_no_role,_no_invented_memory;_a_completed_instance_has_no_context
  Scenario: No role graph and completed instances
    Then without a role graph the context has no role and no role memory
    And a completed instance has no working context

  @test:scripts/tests/workflow-view.test.ts::the_dynamic-state_document_(bean_6h47)::it_is_told_apart_from_the_stage-1_graph_export_by_type_and_schema,_not_only_by_path
  Scenario: The dynamic-state document's identity
    When the dynamic-state document is built for two instances and an unread store "other"
    Then its file is "state.jsonld", its type "cat-harness:DynamicState", its schema the dynamic-state schema, generated at now

  @test:scripts/tests/workflow-view.test.ts::the_dynamic-state_document_(bean_6h47)::one_node_per_instance,_sorted,_with_the_stuck_states_its_page_shows
  Scenario: One node per instance with its stuck states
    Then the nodes are "#workflow/s/a" then "#workflow/s/b"
    And b carries its tokens, bean, page and the same stuck states the classifier gives, including "enabled-not-taken"

  @test:scripts/tests/workflow-view.test.ts::the_dynamic-state_document_(bean_6h47)::what_it_writes_is_a_node_of_the_kind_its_docs_family_names,_and_a_wrong_type_is_refused
  Scenario: The written document is the dynamic-state kind
    Then the written document parses as the dynamic-state kind
    And with type "cat-harness:WorkflowInstance" it is refused

  @test:scripts/tests/workflow-view.test.ts::the_dynamic-state_document_(bean_6h47)::an_unread_store_is_named,_so_its_instances_read_as_unknown,_not_none
  Scenario: An unread store is named
    # Gap: checks only that the store is listed; nothing shows its instances reading as unknown.
    Then the document's unread stores are ["other"]

  @test:scripts/tests/workflow-view.test.ts::the_dynamic-state_document_(bean_6h47)::given_its_published_address,_the_document_states_it_as_@id_and_@base;_the_instance_ids_stay_relative
  Scenario: A published address becomes @id and @base
    When the document is built with its published address
    Then its id and its context's @base are that address, and the node id stays "#workflow/s/a"
    And without an address the id is empty and there is no @base

  @test:scripts/tests/workflow-view.test.ts::the_dynamic-state_document_(bean_6h47)::every_key_it_uses_is_declared_in_its_context:_no_undeclared_term,_no_@vocab
  Scenario: Every key is declared in the context
    Then the context has no @vocab
    And every key used, other than $schema, is a context term or a keyword
    And expanding it as JSON-LD against a base keeps the node IRI "<base>#workflow/s/a"

  @test:scripts/tests/workflow-view.test.ts::startOfUtcDay_/_dayOf_(cat-harness-tools#1230)::two_builds_on_the_same_UTC_day_measure_against_the_same_instant
  Scenario: Builds on one UTC day share an instant
    Then the start of the UTC day of 08:32 and of 23:59 on 2026-11-01 is the same, midnight UTC
    And its day is "2026-11-01"
