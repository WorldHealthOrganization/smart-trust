# A work plan is an epic or milestone that names the process it instantiates:
# schemas/sdlc/work-plan.ts reads it from tags, and the workflow start records it.
# Each Scenario names the test that executes it.
Feature: Work plans read from work-item tags

  @test:scripts/tests/sdlc/work-plan.test.ts::a_work_item's_plan,_read_from_its_tags::a_process_tag_makes_it_a_plan;_a_proposal_tag_says_where_it_came_from
  Scenario: A process tag makes a plan, and a proposal tag says where it came from
    Given the tags "vocabulary", "process:Process_ContentLifecycle" and "proposal:docs/proposals/x.md"
    When the work plan is read from them
    Then its processes are "Process_ContentLifecycle"
    And its proposal is "docs/proposals/x.md"

  @test:scripts/tests/sdlc/work-plan.test.ts::a_work_item's_plan,_read_from_its_tags::no_process_tag,_no_plan_—_a_proposal_alone_is_not_yet_one
  Scenario: Without a process tag there is no plan, even with a proposal
    Given only the tag "proposal:docs/proposals/x.md"
    When the work plan is read from it
    Then there is no plan
    And an empty tag list or no tags at all also give no plan

  @test:scripts/tests/sdlc/work-plan.test.ts::a_work_item's_plan,_read_from_its_tags::several_processes,_in_order,_once_each;_an_empty_value_is_no_value
  Scenario: Several processes are kept in order, once each, and an empty value is dropped
    Given the tags "process:A", "process: B ", "process:A" and "process:"
    When the work plan is read from them
    Then its processes are exactly "A" and "B"

  @test:scripts/tests/sdlc/work-plan.test.ts::work-plan_findings:_reported,_never_fatal::a_plan_filed_as_a_feature,_and_a_proposal_with_no_process
  Scenario: A plan filed as a feature and a proposal with no process are reported
    Given an epic and a milestone tagged with a process, a feature tagged with a process, an epic tagged only with a proposal, and a plain task
    When work-plan findings are computed
    Then findings name exactly the feature "c" and the proposal-only epic "d"

  @test:scripts/tests/sdlc/work-plan.test.ts::an_instance_names_its_plan::startInstance_records_`plan`_when_given,_and_writes_no_key_when_not
  Scenario: startInstance records the plan when given and writes no plan key when not
    Given the bean-drain process model
    When an instance is started with plan "epic1"
    Then the instance's plan is "epic1"
    And an instance started without a plan has no "plan" key

  @test:scripts/tests/sdlc/work-plan.test.ts::a_process_declares_whether_it_starts_from_a_work_plan_(folio-assistant-rwhr)::loadProcessModel_reads_startsFromWorkPlan_when_declared,_leaves_small_processes_unmarked,_and_refuses_non-booleans
  Scenario: loadProcessModel reads startsFromWorkPlan when declared, leaves small processes unmarked, and refuses non-booleans
    Given BPMN diagrams written to a temporary directory
    When each is loaded as a process model
    Then a bare work-plan element marks the process as starting from a work plan
    And a work-plan element with starts "true" marks it true, and with starts "false" marks it false
    And a policy element with workPlan "true" marks it true
    And a process with no declaration has no startsFromWorkPlan key
    And a work-plan element with starts "maybe" is refused as not a boolean

  @test:scripts/tests/sdlc/work-plan.test.ts::a_process_declares_whether_it_starts_from_a_work_plan_(folio-assistant-rwhr)::workflow_start_reports_without_refusing_when_a_work-plan_process_starts_with_no_plan,_and_stays_quiet_otherwise
  Scenario: workflow_start reports, without refusing, a work-plan process started with no plan, and stays quiet otherwise
    Given a root with a "planned" process that declares a work plan and a "small" process that does not
    When "planned" is started with no plan and no bean
    Then it starts, and the answer says "Process_Planned" declares that it starts from a work plan and none was passed
    When "planned" is started with plan "epic-42"
    Then it starts, the answer says it is part of work plan "epic-42", and there is no missing-plan notice
    When "planned" is started with bean "bean-99"
    Then it starts with no missing-plan notice
    When "small" is started with no plan
    Then it starts with no mention of a work plan
