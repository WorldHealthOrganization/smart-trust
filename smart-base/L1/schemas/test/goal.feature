Feature: L1's three goals
  Impact analysis, coverage and citation resolution, answered by the L1
  queries against the smallest documents that exercise them, each document
  first accepted by the validator.

  @test:smart-base/L1/schemas/test/goal.test.ts::every_goal_fixture_validates_against_the_model
  Scenario: every goal fixture validates against the model
    Given the impact and citation fixtures across L1, L2 and L2-DMN
    Then each has no validation errors with the others as external nodes

  @test:smart-base/L1/schemas/test/goal.test.ts::impact:_a_superseded_recommendation_reaches_its_replacement
  Scenario: impact — a superseded recommendation reaches its replacement
    Given a 2012 recommendation superseded by ANC recommendation A.2.1
    Then the impact of the 2012 recommendation is superseded by A.2.1

  @test:smart-base/L1/schemas/test/goal.test.ts::impact:_…and_where_the_replacement_is_printed
  Scenario: impact — and where the replacement is printed
    Then the impact of the 2012 recommendation is presented in the ANC Table 1 row A.2.1

  @test:smart-base/L1/schemas/test/goal.test.ts::impact:_…and_the_evidence_and_outcomes_it_rests_on
  Scenario: impact — and the evidence and outcomes it rests on
    Then the impact of the 2012 recommendation includes the A.2.1 evidence on maternal anaemia and the maternal anaemia outcome

  @test:smart-base/L1/schemas/test/goal.test.ts::impact:_…and_the_DAK_artefact_implementing_it
  Scenario: impact — and the DAK artefact implementing it
    Then the impact of the 2012 recommendation is implemented by the decision-support logic anc-d1

  @test:smart-base/L1/schemas/test/goal.test.ts::coverage:_the_superseded_recommendation_is_the_one_with_no_DAK_representation
  Scenario: coverage — the superseded recommendation is the one with no DAK representation
    Then the unrepresented recommendations are exactly the 2012 recommendation

  @test:smart-base/L1/schemas/test/goal.test.ts::coverage:_DMN_rules_are_counted_cited_/_placeholder_/_none
  Scenario: coverage — DMN rules are counted cited, placeholder or none
    Given a BCG decision table of three rules: one citing a source, one citing "[Add appropriate reference]", one citing nothing
    Then coverage counts one cited, one placeholder and one with none

  @test:smart-base/L1/schemas/test/goal.test.ts::citation_resolution:_the_string_reaches_the_publication_through_its_reference_entry
  Scenario: citation resolution — the string reaches the publication through its reference entry
    When the BCG citation string is resolved
    Then it reaches the immunization summary-tables publication
    And its steps are numberedAs then resolvesTo

  @test:smart-base/L1/schemas/test/goal.test.ts::citation_resolution:_the_mechanical_step_and_the_judgement_are_told_apart
  Scenario: citation resolution — the mechanical step and the judgement are told apart
    When the BCG citation string is resolved
    Then its first step is derived and its second inferred

  @test:smart-base/L1/schemas/test/goal.test.ts::citation_resolution:_a_placeholder_leads_nowhere
  Scenario: citation resolution — a placeholder leads nowhere
    When the "[Add appropriate reference]" citation is resolved
    Then it has no target
