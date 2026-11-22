# A skill or role reference resolves against the layer AND everything it
# `needs`; ownership and subjecthood stay with the layer itself.
# Each Scenario names the test that executes it.
Feature: References resolve across the needs chain

  @test:scripts/tests/resolution-across-needs.test.ts::skill_refs_resolve_across_the_`needs`_chain::some_instance's_closure_is_strictly_wider_than_its_own_skills
  Scenario: Some instance reaches skills through its needs closure
    Given every instance in the repository that declares `needs`
    When each one's own skills are compared with its needs-closure skills
    Then at least one instance has a closure strictly wider than its own skills

  @test:scripts/tests/resolution-across-needs.test.ts::skill_refs_resolve_across_the_`needs`_chain::a_skill_held_anywhere_in_an_instance's_`needs`_closure_is_not_reported_dangling
  Scenario: A skill held in the needs closure is not reported dangling
    Given each instance whose needs closure is wider than its own skills
    When kg-audit runs on it write-free with --check --json
    Then no skill-ref-resolves finding names a skill held in that closure
    And an audit that produces no JSON report counts as an offence

  @test:scripts/tests/resolution-across-needs.test.ts::skill_refs_resolve_across_the_`needs`_chain::no_instance_here_leaves_`needs`_undeclared_(gated),_and_any_that_did_would_report_unknown
  Scenario: No instance leaves needs undeclared
    # Gap: the corpus must have no undeclared instance, so the loop that would check an undeclared one never reports "fail" over an empty list; the "would report unknown" half runs over nothing.
    Given every instance in the repository
    When each is checked for a declared `needs`
    Then the list of instances with no `needs` is empty
    And no undeclared instance reports skill-ref-resolves as "fail"

  @test:scripts/tests/resolution-across-needs.test.ts::skill_refs_resolve_across_the_`needs`_chain::the_two_ownership_criteria_still_read_the_instance's_own_skills
  Scenario: The ownership criteria read the instance's own skills
    # Gap: reads the source text of kg-audit.ts near each criterion's name; it does not run either criterion.
    Given the source of kg-audit.ts
    When the 1600 characters after each of "manifest-skill-exists" and "remote-skill-is-servable" are read
    Then each criterion is still declared
    And its block does not mention resolvableSkills
    And its block contains "!skills.has("

  @test:scripts/tests/resolution-across-needs.test.ts::skill_refs_resolve_across_the_`needs`_chain::absent_`needs`_and_`needs:_[]`_are_different_answers::no_declared_`needs`_—_the_ref_is_unknown,_not_a_failure
  Scenario: A layer with no declared needs reports an unresolved skill as unknown
    Given a synthetic layer whose loadable diagram names a skill nothing holds
    And its declaration on disk has no `needs` key
    When kg-audit runs on it
    Then skill-ref-resolves for the process is "unknown"
    And the first finding says the layer "declares no `needs`"

  @test:scripts/tests/resolution-across-needs.test.ts::skill_refs_resolve_across_the_`needs`_chain::absent_`needs`_and_`needs:_[]`_are_different_answers::`needs:_[]`_—_the_same_ref_is_a_failure,_because_the_floor_is_asserted
  Scenario: A layer declaring needs [] reports the same unresolved skill as a failure
    Given the same synthetic layer with "needs": [] on disk
    When kg-audit runs on it
    Then skill-ref-resolves for the process is "fail"
    And the first finding says there is "no skill in this instance or anything it `needs`"

  @test:scripts/tests/resolution-across-needs.test.ts::role_refs_resolve_across_the_`needs`_chain::a_role_held_anywhere_in_the_`needs`_closure_is_not_reported_dangling
  Scenario: A role held in the needs closure is not reported dangling
    Given every instance with at least one reachable role id
    When kg-audit runs on it write-free
    Then no role-ref-resolves finding names a role that is reachable
    And an audit with no JSON report counts as an offence

  @test:scripts/tests/resolution-across-needs.test.ts::role_refs_resolve_across_the_`needs`_chain::some_instance_resolves_a_role_ONLY_through_its_dependencies
  Scenario: Some instance reaches roles only through its dependencies
    Given every instance in the repository
    When its own role ids are compared with its closure role ids
    Then at least one instance's closure holds more roles than its own graph

  @test:scripts/tests/resolution-across-needs.test.ts::role_refs_resolve_across_the_`needs`_chain::the_audit's_role_SUBJECTS_are_the_instance's_own,_not_its_closure's
  Scenario: The audit's role subjects are the layer's own roles
    Given cat-harness, whose role closure is larger than its own role graph
    When the default kg-audit runs write-free
    Then the number of reports with subject kind "role" equals cat-harness's own role count
