# A skill's I/O contract is found through the skill's own ref, wherever its
# layer keeps it, and publishes under an address keyed by the skill.
# Each Scenario names the test that executes it.
Feature: Skill contracts in subgraphs

  Background:
    Given a layer with skill alpha and its input contract at the root, an orphan root contract, and skill beta in an opt-in L2 subgraph with its input and output contracts there

  @test:scripts/tests/skill-contracts-subgraph.test.ts::contracts_are_found_through_the_skills'_refs,_in_subgraphs_too::the_subgraph's,_the_root's,_and_an_unnamed_root_contract_are_all_the_layer's
  Scenario: Subgraph, root and unnamed root contracts are all the layer's
    When the layer's contracts are listed
    Then they are beta's input and output in L2, alpha's input and the orphan's output
    And there are no collisions

  @test:scripts/tests/skill-contracts-subgraph.test.ts::contracts_are_found_through_the_skills'_refs,_in_subgraphs_too::a_subgraph_contract_is_published_under_the_skill's_address,_with_a_computed_$id
  Scenario: A subgraph contract publishes under the skill's address
    When the skill I/O contracts are built
    Then beta's input comes from L2/schemas/skills/beta/input.schema.json and publishes at skills/beta/input.schema.json
    And its $id is the computed skill I/O IRI
    And its content keeps only $id and the file's own type

  @test:scripts/tests/skill-contracts-subgraph.test.ts::contracts_are_found_through_the_skills'_refs,_in_subgraphs_too::moving_a_contract_into_a_subgraph_does_not_change_where_it_publishes
  Scenario: Moving a contract into a subgraph keeps its address
    Given one layer with beta's input contract at the root and one with it in L2
    Then both publish it at the same path with the same $id

  @test:scripts/tests/skill-contracts-subgraph.test.ts::contracts_are_found_through_the_skills'_refs,_in_subgraphs_too::a_contract_outside_the_conventional_tail_is_keyed_by_its_skill_and_front-matter_key
  Scenario: A contract outside the conventional path is keyed by skill and front-matter key
    Then a contract at L2/contracts/gamma-in.schema.json named by gamma's input is identified as gamma input
    And a conventional path identifies its own skill and io regardless of the naming skill
    And gamma's input publishes at skills/gamma/input.schema.json

  @test:scripts/tests/skill-contracts-subgraph.test.ts::contracts_are_found_through_the_skills'_refs,_in_subgraphs_too::two_files_claiming_one_address:_the_first_by_source_publishes,_the_other_is_reported,_not_dropped
  Scenario: Two files claiming one address are reported as a collision
    Given an extra root contract for beta's input
    When the layer's contracts are listed
    Then only the L2 contract is beta's input
    And the root one is reported as a collision, naming the one kept

  @test:scripts/tests/skill-contracts-subgraph.test.ts::contracts_are_found_through_the_skills'_refs,_in_subgraphs_too::a_ref_to_a_missing_file_publishes_nothing
  Scenario: A ref to a missing file publishes nothing
    Given skill delta naming an input contract that does not exist
    When the layer's contracts are listed
    Then none is delta's

  @test:scripts/tests/skill-contracts-subgraph.test.ts::contracts_are_found_through_the_skills'_refs,_in_subgraphs_too::the_tool_pages_read_a_subgraph_contract_through_the_skill
  Scenario: Tool pages read a subgraph contract through the skill
    When beta's I/O contracts are read for its tool page
    Then they are input and output at their L2 paths
