# The checklist projection of a BPMN diagram follows the edges: every step
# names where it goes next, a decision names each labelled branch, a fork
# names every branch and its join, and the text says it is generated. And
# where each checklist is committed.
Feature: A diagram's checklist follows its edges and is committed in the layer that owns it

  @test:scripts/tests/process/bpmn-checklist.test.ts::the_checklist_projection::says,_in_its_own_text,_that_it_is_generated_and_not_the_authority
  Scenario: The checklist says it is generated and not the authority
    Given a review process with a task, a decision, a parallel fork and join, and two ends
    When its checklist is generated for processes/review.bpmn
    Then its first line is a "GENERATED from processes/review.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit" comment
    And it says "**Generated, and not the authority.**" and names process `Process_Review`

  @test:scripts/tests/process/bpmn-checklist.test.ts::the_checklist_projection::the_start_event_is_an_entry_line_naming_workflow_start
  Scenario: The start event is an entry heading naming workflow_start
    Given the review process
    When its checklist is generated
    Then it has "## Begin — A draft exists (`Start`)"
    And it names `workflow_start` with process "Process_Review"

  @test:scripts/tests/process/bpmn-checklist.test.ts::the_checklist_projection::every_task_names_the_call_that_records_it_and_the_node_it_flows_to_—_by_id,_never_by_position
  Scenario: Each task names its workflow_complete call and its next node by id
    Given the review process
    When its checklist is generated
    Then Task_Review, Task_Publish and Task_Announce each have a `workflow_complete` with their node id
    And their blocks say next → GW_Ok, Join and Join respectively
    And the checklist lists "- Skill: `review-skill`."

  @test:scripts/tests/process/bpmn-checklist.test.ts::the_checklist_projection::a_decision_is_a_Decide_step_naming_each_labelled_branch_and_where_it_goes
  Scenario: A decision names each labelled branch and its target
    Given the review process
    When its checklist is generated
    Then it has "### Decide — Acceptable? (`GW_Ok`)" with an outcome set to the label that holds
    And it lists «yes» → `Fork` and «no» → `End_Rejected` (Rejected)

  @test:scripts/tests/process/bpmn-checklist.test.ts::the_checklist_projection::a_parallel_fork_names_every_branch;_its_join_waits_for_all_of_them
  Scenario: A parallel fork names every branch and its join waits for all
    Given the review process
    When its checklist is generated
    Then it has "### Do all of — `Fork`" with branches to Task_Publish and Task_Announce
    And it has "### Wait for all — `Join`" waiting for every one of the 2 incoming branches

  @test:scripts/tests/process/bpmn-checklist.test.ts::the_checklist_projection::both_end_events_are_exit_lines
  Scenario: Both end events are exit headings
    Given the review process
    When its checklist is generated
    Then it has "## Done — Published (`End_Done`)" and "## Done — Rejected (`End_Rejected`)"

  @test:scripts/tests/process/bpmn-checklist.test.ts::the_checklist_projection::a_changed_diagram_changes_the_checklist_—_what_the_:check_gate_compares
  Scenario: Changing the diagram changes the rendered checklist
    Given review.bpmn rendered to review.checklist.md
    When the task is renamed "Review the draft twice" and the diagram is rendered again
    Then the checklist text differs and contains the new name

  @test:scripts/tests/process/bpmn-checklist.test.ts::where_a_checklist_is_committed_(owner,_2026-10-14:_commit_them,_in_the_layer_that_owns_it)::beside_the_diagram,_in_the_instance_that_owns_it_—_above_the_harness_and_in_it
  Scenario: A diagram in or above the harness gets its checklist beside it
    Given instances b, h (the harness, needing b) and u (needing h), with diagrams in u and h
    When the placements are computed
    Then u's diagram's checklist is beside it, labelled "u/processes/content/y.bpmn"
    And h's diagram's checklist is beside it, labelled "h/processes/z.bpmn"

  @test:scripts/tests/process/bpmn-checklist.test.ts::where_a_checklist_is_committed_(owner,_2026-10-14:_commit_them,_in_the_layer_that_owns_it)::below_the_harness,_the_harness_holds_it:_an_instance_it_needs_must_not_refer_to_it
  Scenario: A diagram below the harness has its checklist in the harness
    Given the same three instances with a diagram in b
    When its placement is computed
    Then its checklist is in the harness's default output directory, labelled "b/processes/x.bpmn"
    And it is not inside b

  @test:scripts/tests/process/bpmn-checklist.test.ts::where_a_checklist_is_committed_(owner,_2026-10-14:_commit_them,_in_the_layer_that_owns_it)::an_instance_the_harness_does_not_name_is_still_below_it_if_it_does_not_reach_it_(cat-harness#787,_bean_w1gy)
  Scenario: An instance that does not reach the harness is below it
    Given instances bootstrap, bootstrap-tools, cat-harness and cat-harness-tools with a diagram in bootstrap-tools
    When its placement is computed with cat-harness as the harness
    Then its checklist is in cat-harness's default output directory, labelled "bootstrap-tools/processes/r.bpmn"

  @test:scripts/tests/process/bpmn-checklist.test.ts::where_a_checklist_is_committed_(owner,_2026-10-14:_commit_them,_in_the_layer_that_owns_it)::the_cited_source_names_the_instance,_so_the_text_is_the_same_wherever_the_instance_is_checked_out
  Scenario: The generated note cites the source by instance-relative path
    # Gap: the body renders from one checkout only; it does not check the text is the same from another location
    Given the three-instance checkout with a diagram in u
    When its checklist is rendered
    Then its first line contains "GENERATED from u/processes/content/y.bpmn"

  @test:scripts/tests/process/bpmn-checklist.test.ts::where_a_checklist_is_committed_(owner,_2026-10-14:_commit_them,_in_the_layer_that_owns_it)::a_checklist_with_no_diagram_is_an_orphan;_one_with_a_diagram_is_not
  Scenario: Only a checklist with no diagram is an orphan
    Given y.checklist.md, which is expected, and gone.checklist.md, which is not, in u's processes
    When the orphans are listed
    Then they are exactly gone.checklist.md

  @test:scripts/tests/process/bpmn-checklist.test.ts::where_a_checklist_is_committed_(owner,_2026-10-14:_commit_them,_in_the_layer_that_owns_it)::--out_puts_every_checklist_in_one_directory,_and_a_stem_two_diagrams_share_is_refused,_not_overwritten
  Scenario: With --out, a stem two diagrams share is refused
    Given two diagrams both named x.bpmn, in b and in u
    When both are rendered into one output directory
    Then exactly one x.checklist.md is written there
    And one render failed
