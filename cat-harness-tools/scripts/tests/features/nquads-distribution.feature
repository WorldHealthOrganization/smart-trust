# The W3C N-Quads distribution and named query execution over an in-memory
# store. Each Scenario names the test that executes it.
Feature: N-Quads distribution and named queries

  @test:scripts/tests/nquads-distribution.test.ts::W3C_N-Quads_Distribution_&_Named_Query_Engine::enforces_partition_budget_ceiling_constant
  Scenario: The partition budget ceiling is 5 MiB
    Then the recommended maximum partition size is 5 * 1024 * 1024 bytes

  @test:scripts/tests/nquads-distribution.test.ts::W3C_N-Quads_Distribution_&_Named_Query_Engine::safely_binds_typed_parameters_without_SPARQL_injection
  Scenario: Typed parameters are bound without SPARQL injection
    When a string, an integer and an IRI are bound into a query
    Then the string is quoted, the integer typed as xsd:integer, and the IRI bracketed
    And binding an IRI parameter that is not an IRI throws naming an invalid IRI parameter

  @test:scripts/tests/nquads-distribution.test.ts::W3C_N-Quads_Distribution_&_Named_Query_Engine::validates_manifest_schema_and_executes_named_queries_with_Graph_Availability_Guard
  Scenario: A manifest validates and a named query runs with the graph availability guard
    Given a spine partition and one subgraph partition, gzipped, and a manifest naming a third, absent subgraph
    When the manifest is parsed and the named query over the present subgraph is run
    Then it loads 4 quads and returns one row with the community's title
    And the named query requiring the absent subgraph rejects with a missing partition error
