# The PROV-O QA/QC report (issue #1180, step 5): a workflow history becomes
# prov:Activity records and each step's authorisation is re-run after it.
# Nothing is invented. Each Scenario names the test that executes it.
Feature: The PROV-O QA/QC report

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_the_record::an_activity_maps_to_a_valid_prov:Activity_with_agent,_lane_role,_plan_and_policy
  Scenario: An activity maps to a valid prov:Activity with agent, lane role, plan and policy
    Given a permitted actor claiming a bean in code-change-review
    When the instance is reported
    Then there are no findings and one valid activity naming the agent, the authoring-agent role, the step as plan, and the policy

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_the_record::start_and_end_events_are_not_activities,_and_are_skipped
  Scenario: Start and end events are not activities
    When a history holding only the start event is reported
    Then nothing is checked and no activity is emitted

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_the_record::the_plan's_stem_is_the_file_name,_lower-cased,_so_it_satisfies_PLAN_REF
  Scenario: The plan's stem is the file name, lower-cased
    Then the stem of a/b/Code-Change-Review.bpmn is code-change-review

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_the_record::several_policies_are_all_named,_as_a_JSON-LD_array
  Scenario: Several policies are all named as a sorted array
    Given two policies in force
    Then the activity's underPolicy lists both, sorted

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_findings::no_matching_permission_is_`unknown`,_and_is_a_finding,_never_a_permit
  Scenario: No matching permission is an unknown finding
    When the step is reported with no permission
    Then the only finding is unknown

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_findings::a_prohibition_is_a_`deny`_finding
  Scenario: A prohibition is a deny finding
    When the step is reported under a permission and an equal prohibition
    Then the only finding is deny

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_findings::an_actor_not_eligible_for_the_lane's_role_is_a_finding
  Scenario: An actor not eligible for the lane's role is a finding
    When a code reviewer performs the authoring step
    Then the only finding is not-eligible, saying not as authoring-agent

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_findings::an_undeclared_actor_is_a_finding
  Scenario: An undeclared actor is a finding
    When an undeclared actor performs the step
    Then the findings are undeclared-actor and unknown

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_findings::a_missing_actor_is_a_finding,_and_NO_activity_is_emitted_rather_than_an_invented_agent
  Scenario: A missing actor is a finding and no activity is invented
    When a step with no actor is reported
    Then a no-actor finding is raised, no activity is emitted, nothing is invalid, and one step was checked

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_findings::a_lane_that_binds_no_role_is_a_finding,_and_NO_activity_is_emitted_rather_than_an_invented_role
  Scenario: A lane that binds no role is a finding and no role is invented
    Given a role graph declaring no roles
    When the step is reported
    Then a no-role finding says the lane names an undeclared role, no activity is emitted, and nothing is invalid

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_findings::a_recorded_authz_verdict_that_disagrees_with_the_recomputed_one_is_a_finding
  Scenario: A recorded authorisation verdict that disagrees with the recomputed one is a finding
    Given a step recording a permit
    Then reported under the granting policy there are no findings
    And reported with no permission the findings are authz-disagrees and unknown, saying permit became unknown

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_findings::a_node_the_model_does_not_have_is_a_finding
  Scenario: A node the model does not have is a finding
    When a step on a node the diagram lacks is reported
    Then the only finding is node-not-in-model

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_outputs::JSON_is_written_with_sorted_keys
  Scenario: JSON is written with sorted keys
    Then nested objects are written with their keys sorted and a final newline

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_outputs::--check:_current_outputs_pass;_an_edited_output_is_stale;_a_leftover_log_is_an_orphan
  Scenario: The check finds current outputs clean, an edited output stale, and a leftover log an orphan
    Given the report's outputs written to a site
    Then nothing is stale or orphaned
    And the PROV log links the plan at the process's release address
    And after editing the log it is stale, and an extra log is an orphan

  @test:scripts/tests/prov-qaqc.test.ts::prov-qaqc:_outputs::the_page_states_the_report_is_advisory_and_gives_totals_by_finding
  Scenario: The page says the report is advisory and totals findings by kind
    Then the page says Advisory and counts one unknown finding
