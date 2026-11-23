# The external-registry role held to the side of its contract that is ours: which lane
# relies on it in processes/kg/kg-to-portal.bpmn and what the verifier does when it is
# not met. Each Scenario names the test that executes it.
Feature: The external-registry role and its contract

  @test:schemas/external-registry-contract.test.ts::the_role_is_played_by_an_external_party,_and_its_contract_is_a_skill_it_carries::actorKinds_is_external_only,_and_it_carries_external-registry-contract
  Scenario: The external-registry role is external only and carries its contract skill
    Given the "external-registry" role in scenarios/roles.json
    Then its actorKinds are exactly "external"
    And its skills include "external-registry-contract"

  @test:schemas/external-registry-contract.test.ts::Where_the_diagrams_lean_on_it:_one_lane,_Lane_Portal_in_kg-to-portal,_holding_P_Verify_and_GW_Verified::in_this_repository's_processes_exactly_one_lane_names_the_role,_through_partitionElementRef
  Scenario: Exactly one lane in the processes names the external-registry role
    Given every .bpmn file under processes/
    When lanes whose partitionElementRef is "external-registry" are collected
    Then the only one is "processes/kg/kg-to-portal.bpmn#Lane_Portal"

  @test:schemas/external-registry-contract.test.ts::Where_the_diagrams_lean_on_it:_one_lane,_Lane_Portal_in_kg-to-portal,_holding_P_Verify_and_GW_Verified::the_role_is_declared_as_a_top-level_resource,_and_the_lane_holds_P_Verify_and_GW_Verified
  Scenario: The role is a top-level resource and its lane holds P_Verify and GW_Verified
    Given processes/kg/kg-to-portal.bpmn
    Then it declares a resource with id "external-registry"
    And the portal lane's flow node refs include "P_Verify" and "GW_Verified"

  @test:schemas/external-registry-contract.test.ts::What_the_verifier_does_when_the_contract_is_not_met:_never_a_pass::GW_Verified_serves_the_bytes_on_exactly_one_branch,_the_match,_and_has_no_default
  Scenario: GW_Verified serves the bytes only on the match branch and has no default
    Given the sequence flows leaving GW_Verified
    Then exactly one goes to End_Served, named "signature and digests match"
    And the gateway has no default flow

  @test:schemas/external-registry-contract.test.ts::What_the_verifier_does_when_the_contract_is_not_met:_never_a_pass::every_other_branch_goes_to_End_Rejected,_which_serves_the_previous_version
  Scenario: Every other GW_Verified branch goes to End_Rejected, which serves the previous version
    Given the sequence flows leaving GW_Verified that do not go to End_Served
    Then there is at least one
    And each goes to End_Rejected
    And End_Rejected's name says "serve the previous version"

  @test:schemas/external-registry-contract.test.ts::What_the_verifier_does_when_the_contract_is_not_met:_never_a_pass::the_lane_states_that_an_unreachable_registry_is_`unknown`,_routed_as_a_mismatch,_never_a_guessed_pass
  Scenario: The portal lane documents an unreachable registry as unknown, routed as a mismatch
    # Gap: checks the lane's documentation text only; the routing of an unreachable registry is not exercised
    Given the portal lane's documentation, whitespace collapsed
    Then it says when the registry "cannot be reached, this lane's answer is `unknown`"
    And it says it "routes it the same way as a mismatch"
    And it says "never to a guessed pass"
