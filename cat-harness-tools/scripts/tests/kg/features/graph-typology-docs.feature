# The graph-typology kind table in docs/cat-harness/kind-table.md (read by scripts/kind-table.ts) must
# name exactly the kinds the graph-typology registry knows, and a kind description's links are
# rebased onto the table's page. Each Scenario names the test that executes it.
Feature: The graph-typology table matches the registry

  @test:scripts/tests/kg/graph-typology-docs.test.ts::the_graph-typology_table_and_the_registry_name_the_same_kinds::the_table_is_found,_and_is_not_empty
  Scenario: The kind table is found and is not empty
    Given the hand-written graph-typology kind table
    When its documented kinds are read
    Then there are more than 5 of them

  @test:scripts/tests/kg/graph-typology-docs.test.ts::the_graph-typology_table_and_the_registry_name_the_same_kinds::every_kind_in_the_table_exists_in_the_registry
  Scenario: Every kind in the table exists in the registry
    Given the documented kinds and the set of valid kind names
    When the documented kinds are checked against the valid names
    Then no documented kind is unknown

  @test:scripts/tests/kg/graph-typology-docs.test.ts::the_graph-typology_table_and_the_registry_name_the_same_kinds::every_registered_kind_appears_in_the_table
  Scenario: Every registered kind appears in the table
    Given the kinds registered in the default graph-typology registry
    When they are checked against the documented kinds
    Then no registered kind is missing from the table

  @test:scripts/tests/kg/graph-typology-docs.test.ts::a_kind_description's_links_are_rebased_onto_the_table's_page::a_link_written_from_skills/kg/kg-core/_names_the_same_file_from_docs/cat-harness/
  Scenario: A link written from skills/kg/kg-core/ is rebased to name the same file from docs/cat-harness/
    Given a link "../../../sdlc/skills/sdlc-core/qa-witness.md#scope" written from skills/kg/kg-core/
    When the kind description's links are rebased
    Then it becomes "../../sdlc/skills/sdlc-core/qa-witness.md#scope"
    And the link "../kg-core/schema-management.md" becomes "../../skills/kg/kg-core/schema-management.md"

  @test:scripts/tests/kg/graph-typology-docs.test.ts::a_kind_description's_links_are_rebased_onto_the_table's_page::an_absolute_URL,_a_site-rooted_path_and_an_anchor_are_left_as_they_are
  Scenario: An absolute URL, a site-rooted path and an anchor are left as they are
    Given links to "https://example.org/x.md", "/cat-harness/kind-table/" and "#node-schemas"
    When the links are rebased
    Then the text is unchanged
