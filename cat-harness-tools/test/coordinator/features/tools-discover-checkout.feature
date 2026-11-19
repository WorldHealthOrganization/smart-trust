# Specifies tools, toolsOf and discoverTools (tools/discover.ts) over the
# checkout.
Feature: Tool discovery covers every declaring instance and mints io types against one document

  @test:test/coordinator/tools-discover-checkout.test.ts::tools()_over_this_checkout::includes_every_instance_that_declares_a_tools_graph_—_smart-base's_no_longer_invisible
  Scenario: Discovery includes every instance that declares a tools graph
    Given the Tools discovered across the checkout
    When their ids and sources are read
    Then they include "discuss" and "dmn-to-questionnaire"
    And discovery reports no failures
    And its sources include cat-harness, fhir-harness and smart-base
    Given every instance root in the checkout whose declaration resolves a "tools" graph, at least three of them
    When discovery runs over the checkout
    Then every one of those instances is among its sources

  @test:test/coordinator/tools-discover-checkout.test.ts::tools()_over_this_checkout::toolsOf(cat-harness)_is_the_harness's_own_graph_only_—_what_its_document_publishes
  Scenario: cat-harness's own Tools are only its own graph
    Given the Tools of the cat-harness instance alone
    When they are compared with all discovered Tools
    Then they include "discuss"
    And they do not include "dmn-to-questionnaire"
    And there are fewer of them than of all Tools

  @test:test/coordinator/tools-discover-checkout.test.ts::tools()_over_this_checkout::every_discovered_Tool's_io_types_point_into_the_harness's_published_types_document
  Scenario: Every Tool's io types point into the harness's published types document
    Given every discovered Tool's input and output schemas
    When the document part of each schema IRI is taken
    Then there is exactly one
    And it is the "$id" the harness's own writer gives its Tool types document
