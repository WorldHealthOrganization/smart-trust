# src/tools/bean-query.ts registers the bean_query MCP tool, which runs a named SPARQL query
# over the repository's bean store and returns its rows. Each Scenario names the test that executes it.
Feature: The bean_query MCP tool

  @test:src/tools/bean-query.test.ts::bean-query_MCP_tool::registers_bean_query_tool_on_McpServer
  Scenario: The bean_query tool is registered on an MCP server
    Given an MCP server
    When the bean-query tool is registered on it for this repository
    Then the server's registered tools include "bean_query"

  @test:src/tools/bean-query.test.ts::bean-query_MCP_tool::executes_default_safe_drain_candidates_query
  Scenario: The default safe_drain_candidates query returns the rows the query gives over the real store
    Given the bean_query tool registered for this repository
    When it is called with the named query "safe_drain_candidates" in "json" format
    Then the first content item is text holding a JSON array
    And the repository's bean store holds at least one bean
    And the array equals the rows of "safe_drain_candidates" run directly over that store

  @test:src/tools/bean-query.test.ts::bean-query_MCP_tool::returns_the_rows_as_structuredContent_in_every_format
  Scenario: The rows are returned as structuredContent in every format
    Given the bean_query tool registered for this repository
    When "safe_drain_candidates" is called in "json" format and in "table" format
    Then the json call's structuredContent rows equal its parsed text
    And the table call's structuredContent rows equal the json call's
