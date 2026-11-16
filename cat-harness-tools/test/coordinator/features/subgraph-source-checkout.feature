# Specifies declaredSubgraph and checkoutDirectories
# (schemas/kg/harness-config.ts) over every subgraph the checkout's
# instances declare.
Feature: Every declared subgraph in the checkout resolves

  @test:test/coordinator/subgraph-source-checkout.test.ts::THE_GATE_—_every_declared_subgraph_in_this_checkout_resolves::the_checkout_declares_subgraphs_to_check
  Scenario: The checkout declares subgraphs
    Given the checkout's own top-level declared directories
    When their ids are collected
    Then there is at least one

  @test:test/coordinator/subgraph-source-checkout.test.ts::THE_GATE_—_every_declared_subgraph_in_this_checkout_resolves::each_resolves_(a_branch_source_needs_no_table_row:_the_declaration_is_the_authority,_bean_rva2)
  Scenario: Every declared subgraph resolves
    Given each declared subgraph id
    When it is resolved
    Then each resolves to a subgraph, ids declared by several instances aside
    And nothing throws for any other reason
