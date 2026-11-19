# instanceHarnesses in scripts/mount-instance-docs.ts lists, for one layer's own site, the
# layer itself and the harnesses it is built on, never the platform's other harnesses.
# Each Scenario names the test that executes it.
Feature: An instance site's harness list

  @test:scripts/tests/instance-harnesses.test.ts::instanceHarnesses::the_instance_comes_first_and_links_to_its_own_site's_root
  Scenario: The instance comes first and links to its own site's root
    # Skipped: when the checkout does not hold smart-immunizations and smart-base
    Given the harness rows for smart-immunizations on the platform at "https://example.org/fa"
    When the first row is read
    Then its label is the title of smart-immunizations' declaration, else "smart-immunizations"
    And its href is "."

  @test:scripts/tests/instance-harnesses.test.ts::instanceHarnesses::it_lists_the_harnesses_the_instance_is_built_on,_re-based_on_the_platform
  Scenario: A harness the instance is built on is listed, re-based on the platform
    # Skipped: when the checkout does not hold smart-immunizations and smart-base
    Given the harness rows for smart-immunizations on the platform at "https://example.org/fa"
    When the row labelled "SMART Base" is found
    Then its href is "https://example.org/fa/smart-base/"

  @test:scripts/tests/instance-harnesses.test.ts::instanceHarnesses::it_lists_nothing_the_instance_is_not_built_on
  Scenario: A harness the instance is not built on is not listed
    # Skipped: when the checkout does not hold smart-immunizations and smart-base
    Given the harness rows for smart-immunizations on the platform at "https://example.org/fa"
    When their labels are read
    Then none of them is "smart-trust", "WHO SMART Trust", "Folio Assistant" or "folio-assistant-sci"

  @test:scripts/tests/instance-harnesses.test.ts::instanceHarnesses::it_lists_a_layer_reached_only_through_another_layer's_`needs`
  Scenario: A layer reached only through another layer's needs is listed
    # Skipped: when the checkout does not hold smart-immunizations and smart-base
    Given the harness rows for smart-immunizations, whose smart-base layer needs who-iris
    When their labels are read
    Then they include "WHO IRIS"
