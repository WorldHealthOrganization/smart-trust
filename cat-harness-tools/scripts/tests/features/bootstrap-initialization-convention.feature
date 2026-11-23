# The initialization-doc convention in schemas/kg/cat-harness.ts: initializationDoc composes every layer's
# initialization instructions path from siteDir, the same for every instance, and bootstrap's README states it.
# Each Scenario names the test that executes it.
Feature: Every layer keeps its initialization instructions in the same place

  @test:scripts/tests/bootstrap-initialization-convention.test.ts::the_convention_is_composed,_not_spelled::it_is_built_from_siteDir_rather_than_a_literal
  Scenario: The initialization doc path is composed from siteDir
    Given the instance names "f-a-sci", "smart-base" and "anything-at-all"
    When the initialization doc path is computed for each
    Then each path is the instance's siteDir followed by "bootstrap/initialization.md"

  @test:scripts/tests/bootstrap-initialization-convention.test.ts::the_convention_is_composed,_not_spelled::it_is_the_SAME_suffix_for_every_instance
  Scenario: The path suffix after the site root is the same for every instance
    Given the instance names "a", "b" and "c"
    When the initialization doc path is computed for each
    Then the parts after the first path segment are identical across all three

  @test:scripts/tests/bootstrap-initialization-convention.test.ts::the_convention_is_composed,_not_spelled::the_stub_does_NOT_appear_—_the_suffix_is_the_same_for_every_instance
  Scenario: The stub does not appear in the initialization doc path
    # Gap: does not check that the layer's directory uses this suffix
    Given an instance "smart-base" with stub "base"
    When its initialization doc path is computed
    Then the path does not contain "base/"
    And it equals the path computed for an instance "anything-at-all" with no stub

  @test:scripts/tests/bootstrap-initialization-convention.test.ts::this_instance_honours_the_convention_it_publishes::the_file_is_where_the_convention_says
  Scenario: This layer's initialization doc exists where the convention says
    Given this layer's own declaration
    When its initialization doc path is computed
    Then a file exists at that path under the layer root

  @test:scripts/tests/bootstrap-initialization-convention.test.ts::this_instance_honours_the_convention_it_publishes::and_it_is_DECLARED,_so_the_asset_gate_checks_its_links_too
  Scenario: The initialization doc is declared as a bootstrap-initialization asset
    Given this layer's own declaration
    When its asset with role "bootstrap-initialization" is looked up
    Then that asset's src is the computed initialization doc path

  @test:scripts/tests/bootstrap-initialization-convention.test.ts::the_README_tells_an_agent_the_same_path_the_code_computes::bootstrap's_README_states_the_convention_in_its_fenced_block
  Scenario: Bootstrap's README states the convention in a fenced block
    Given the repository's bootstrap/README.md
    When its fenced code blocks are read, indented ones included
    Then one block is exactly "<name>/docs/bootstrap/initialization.md"

  @test:scripts/tests/bootstrap-initialization-convention.test.ts::the_README_tells_an_agent_the_same_path_the_code_computes::the_convention_is_stated_in_ONE_place,_not_echoed_into_the_skill
  Scenario: The confirm-harness skill does not repeat the convention's path
    Given the repository's bootstrap/skills/confirm-harness.md
    When its text is read
    Then it does not contain "bootstrap/initialization.md"
