# Specifies that the checkout has instance declarations to check, and that
# each instance root's declaration parses as a Knowledge Graph declaration.
Feature: Every declaration in the checkout is a Knowledge Graph declaration

  @test:test/coordinator/bootstrap-reading-checkout.test.ts::every_declaration_in_this_repository_is_a_Knowledge_Graph_declaration::there_are_declarations_to_check
  Scenario: The checkout has more than three instance declarations
    Given the checkout root
    When its instance roots are found
    Then there are more than 3

@test:test/coordinator/bootstrap-reading-checkout.test.ts::every_declaration_in_this_repository_is_a_Knowledge_Graph_declaration::the_declaration_at_%s_parses_as_a_Knowledge_Graph_declaration
  Scenario: Each instance root's declaration parses as a Knowledge Graph declaration
    Given a table with one row per instance root in the checkout, named by its path below the checkout root ("/" for the root itself)
    When each row's declaration file is parsed with the Knowledge Graph declaration schema
    Then every parse succeeds
