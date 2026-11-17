# Specifies that each adopting publisher's document (todos.jsonld) follows
# the subgraph-node publication pattern.
Feature: Every adopting subgraph publisher follows the subgraph-node pattern

  @test:test/coordinator/subgraph-node-checkout.test.ts::every_adopting_publisher_follows_the_pattern::todos:_the_published_todos.jsonld_has_no_publication_finding_against_the_declared_todos_subgraph
  Scenario: The published todos document follows the subgraph publication pattern
    Given the todos.jsonld the docs:pages build writes, the test skipped when the site is not built
    And the subgraph node the checkout declares for "todos", which exists
    When the document is checked against that node's IRI
    Then there is no publication finding
