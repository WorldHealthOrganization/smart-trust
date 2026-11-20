# The rendering exemption in schemas/kg/cat-harness.ts: a layer may be excused a render obligation only by declaring it with a reason and a substitute it owes, and at most one layer may claim it.
# Each Scenario names the test that executes it.
Feature: The rendering exemption

  @test:schemas/render-exemption-harness.test.ts::this_repository's_actual_declaration::bootstrap_claims_the_exemption,_and_it_is_well-formed
  Scenario: Bootstrap declares a well-formed rendering exemption
    Given this repository's bootstrap declaration
    Then it carries a rendering exemption
    And the exemption raises no problems

  @test:schemas/render-exemption-harness.test.ts::this_repository's_actual_declaration::it_excuses_BOTH_visualisers_the_owner_named,_and_nothing_else
  Scenario: Bootstrap's exemption excuses exactly the two visualisers
    Given this repository's bootstrap declaration
    Then its exemption excuses exactly "visualiser" and "workflow-visualiser"

  @test:schemas/render-exemption-harness.test.ts::this_repository's_actual_declaration::EXACTLY_one_instance_in_this_repository_claims_it
  Scenario: Exactly one layer in this repository claims the exemption
    Given every instance discovered in the repository, bootstrap among them
    When those whose declaration claims a rendering exemption are counted
    Then there is exactly 1
    And it is "bootstrap"

  @test:schemas/render-exemption-harness.test.ts::this_repository's_actual_declaration::what_it_OWES_exists_on_disk_—_the_two_render_skills_it_names
  Scenario: The render skills the exemption owes exist on disk
    # Gap: the title says two skills; the test requires only at least one.
    Given the "owes" text of bootstrap's exemption
    When the "bootstrap-graph-*.md" paths it names are collected
    Then there is at least one
    And each exists under bootstrap

  @test:schemas/render-exemption-harness.test.ts::this_repository's_actual_declaration::the_subgraph_it_owes_is_DECLARED,_not_merely_present
  Scenario: Each owed render skill sits in a directory bootstrap declares as a skills graph
    Given the "bootstrap-graph-*.md" paths named in bootstrap's "owes" text
    Then there is at least one
    And each sits under a directory bootstrap declares
    And that directory's graph typologies include "skills"

  @test:schemas/render-exemption-harness.test.ts::a_claim_that_is_not_well-formed_is_refused::no_reason
  Scenario: An exemption with no reason is refused
    Given an otherwise well-formed exemption with an empty reason
    When its problems are listed
    Then there is 1

  @test:schemas/render-exemption-harness.test.ts::a_claim_that_is_not_well-formed_is_refused::no_substitute_—_the_hole_this_field_exists_to_close
  Scenario: An exemption with no substitute is refused
    Given an otherwise well-formed exemption with an empty "owes"
    When its problems are listed
    Then there is 1

  @test:schemas/render-exemption-harness.test.ts::a_claim_that_is_not_well-formed_is_refused::excused_from_nothing
  Scenario: An exemption that excuses nothing is refused
    Given an otherwise well-formed exemption whose "of" list is empty
    When its problems are listed
    Then there is 1

  @test:schemas/render-exemption-harness.test.ts::a_claim_that_is_not_well-formed_is_refused::an_obligation_nobody_has_defined
  Scenario: An exemption naming an undefined obligation is refused
    Given an otherwise well-formed exemption excusing "prettiness"
    When its problems are listed
    Then there is 1

  @test:schemas/render-exemption-harness.test.ts::a_claim_that_is_not_well-formed_is_refused::and_a_well-formed_one_is_NOT_refused
  Scenario: A well-formed exemption is not refused
    Given an exemption of "visualiser" with a reason and a substitute
    When its problems are listed
    Then there are none

  @test:schemas/render-exemption-harness.test.ts::the_exemption_does_not_spread::two_claimants_is_a_finding,_and_it_names_them
  Scenario: Two layers claiming the exemption is one problem naming both
    Given "bootstrap" and "cat-harness" both claiming a well-formed exemption
    When the problems are listed
    Then there is 1
    And it names "bootstrap" and "cat-harness"

  @test:schemas/render-exemption-harness.test.ts::the_exemption_does_not_spread::none_is_fine_—_at_most_one,_not_exactly_one
  Scenario: No layer claiming the exemption is not a problem
    Given one layer "some-folio" with no exemption
    When the problems are listed
    Then there are none

  @test:schemas/render-exemption-harness.test.ts::isExemptFrom_is_what_the_QA_axis_calls::true_for_a_listed_obligation,_false_for_an_unlisted_one
  Scenario: A layer is exempt from a listed obligation and not from an unlisted one
    Given a declaration whose exemption lists only "visualiser"
    Then it is exempt from "visualiser"
    And it is not exempt from "workflow-visualiser"

  @test:schemas/render-exemption-harness.test.ts::isExemptFrom_is_what_the_QA_axis_calls::false_for_an_instance_that_declares_no_exemption
  Scenario: A layer with no exemption is exempt from nothing
    Given a declaration with no rendering exemption
    Then it is not exempt from "visualiser"

  @test:schemas/render-exemption-harness.test.ts::the_obligations_are_a_closed_set::all_three_are_named,_and_adding_one_is_a_deliberate_edit
  Scenario: The render obligations are exactly "own-docs", "visualiser" and "workflow-visualiser"
    When the defined render obligations are listed
    Then they are exactly "own-docs", "visualiser" and "workflow-visualiser"
