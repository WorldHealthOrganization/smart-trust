# The three lane → Role → Skill report entries kg:audit writes. Each fires on
# the case it names and stays quiet on its neighbours.
Feature: The lane-role report entries fire on their case and no other

  @test:scripts/tests/process/lane-role-criteria.test.ts::the_criteria_are_declared,_and_none_of_them_gates::minor,_which_neither_--check_nor_--strict_fails_on
  Scenario: The three criteria are declared minor
    # Gap: the title says neither --check nor --strict fails on them; the body only checks their declared severity is "minor", it runs neither mode
    Given the KG criteria lane-role-legacy-binding, task-skill-outside-lane-role and mechanical-role-untested
    When their declarations are looked up
    Then each has severity "minor"

  @test:scripts/tests/process/lane-role-criteria.test.ts::lane-role-legacy-binding::every_lane_laneRoleRef_warned_about,_with_its_warning,_and_no_other
  Scenario: Only a lane with a role-binding warning is reported
    Given lane L1 with the warning "deprecated ref" and lane L2 with none
    When the legacy-binding findings are computed
    Then there is exactly one, at L1, with detail "deprecated ref"

  @test:scripts/tests/process/lane-role-criteria.test.ts::task-skill-outside-lane-role::inherited_skills_count,_variable_lanes_and_undeclared_roles_are_skipped
  Scenario: A task skill outside its lane's role is reported, with inheritance counted
    Given a role graph where "lead" inherits "reviewer"
    And a build task naming "publish-site" outside its lane's role, a review task naming skills of lead and its inherited reviewer, a task in a performer-varies lane, a task in a lane bound to an undeclared role, and a gateway
    When skills outside the lane role are computed
    Then only T_Build is reported
    And its detail names "publish-site"

  @test:scripts/tests/process/lane-role-criteria.test.ts::mechanical-role-untested::n/a_for_a_role_a_person_or_agent_takes_on
  Scenario: A role people or agents take on is not assessed
    Given the "reviewer" role, played by person and agent
    When mechanical-role-untested is assessed with no tested skills
    Then the result is undefined

  @test:scripts/tests/process/lane-role-criteria.test.ts::mechanical-role-untested::fires_on_a_contract_with_no_test,_and_on_a_role_with_no_contract_at_all
  Scenario: A mechanical role with an untested skill, or with no skill, is reported
    Given the system role "build-pipeline" with skill "run-build" and the external role "external-registry" with no skills
    When mechanical-role-untested is assessed with no tested skills
    Then build-pipeline gives one finding
    And external-registry's finding says it "lists no skill"

  @test:scripts/tests/process/lane-role-criteria.test.ts::mechanical-role-untested::quiet_once_one_skill_names_a_test;_an_EMPTY_tested-by_is_not_a_test
  Scenario: A mechanical role is quiet once a skill names a test, but not for an empty tested-by
    Given the "store" role with skill "hold-records"
    When hold-records' front matter lists a tested-by file
    Then there are no findings
    When hold-records' front matter has tested-by: []
    Then there is one finding

  @test:scripts/tests/process/lane-role-criteria.test.ts::skill-edges::absent_keys_read_as_not_said,_not_as_empty
  Scenario: Absent edge keys read as not said
    Given front matter with no edge keys, and text with no front matter
    When the skill edges are read
    Then each is an empty object

  @test:scripts/tests/process/lane-role-criteria.test.ts::skill-edges::a_scalar_is_a_one-item_list;_both_keys_as_lists
  Scenario: A scalar edge is a one-item list, and list forms are read
    Given front matter "uses-methodology: raci"
    When the skill edges are read
    Then usesMethodology is ["raci"]
    Given front matter with uses-methodology as a flow list and tested-by as a block list
    When the skill edges are read
    Then usesMethodology is ["raci", "grade"] and testedBy is ["a.test.ts"]
