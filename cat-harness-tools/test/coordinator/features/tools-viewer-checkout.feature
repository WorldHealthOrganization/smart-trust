# Specifies the Tools page (scripts/gen-tools-viz.ts: toolRows, skillIds,
# page, publishedPage, pageRelPath, toolSubjects) and the docs page declared
# for cat-harness's tools graph, over the checkout.
Feature: The tools graph has its own docs page, every satisfies resolves, and the Tools pages are current

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_tools_graph_is_not_documented_by_the_skills_page::has_a_corpus_at_all
  Scenario: The tools corpus is not empty
    Given cat-harness's Tools
    When their rows are built
    Then there is at least one

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_tools_graph_is_not_documented_by_the_skills_page::declares_a_docs_page
  Scenario: Exactly one docs page documents the tools graph
    Given cat-harness's directory entry for the "tools" typology and the checkout's tracked pages
    When the pages documenting it are found
    Then there is exactly one

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_tools_graph_is_not_documented_by_the_skills_page::and_it_resolves
  Scenario: The tools docs page exists
    Given the page documenting the tools graph
    When it is looked up in the checkout
    Then it exists

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_tools_graph_is_not_documented_by_the_skills_page::and_it_is_about_tools_—_approximated,_and_the_approximation_is_stated
  Scenario: The tools docs page uses the tools graph's vocabulary
    Given the page documenting the tools graph
    When it is read
    Then it contains "defineTool" and "satisfies"
    And it mentions "tool"

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_tools_graph_is_not_documented_by_the_skills_page::the_skills_page_is_NOT_silently_repurposed_as_the_tools_page
  Scenario: The skills page is not the tools page
    Given the pages documenting the tools graph
    When they are read
    Then none ends with "skills.md"

  @test:test/coordinator/tools-viewer-checkout.test.ts::every_satisfies_names_a_skill_that_exists::the_skill_corpus_is_non-empty
  Scenario: The skill corpus is not empty
    Given the checkout
    When the skill ids are collected
    Then there is at least one

  @test:test/coordinator/tools-viewer-checkout.test.ts::every_satisfies_names_a_skill_that_exists::no_tool_advertises_a_capability_the_graph_cannot_locate
  Scenario: Every satisfies names a known skill
    Given the satisfies of every Tool row
    When each is looked up among the skill ids
    Then there is at least one satisfies
    And every one is a known skill

  @test:test/coordinator/tools-viewer-checkout.test.ts::every_satisfies_names_a_skill_that_exists::and_every_tool_says_what_it_satisfies
  Scenario: Every Tool says what it satisfies
    Given the Tool rows
    When those with no satisfies are collected
    Then there are none

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_page_reports_the_join_in_both_directions::states_that_all_resolve,_rather_than_only_warning_when_they_do_not
  Scenario: The page states that every satisfies resolves
    Given the Tools page rendered from the rows and the skill ids
    When it is read
    Then it asks "Does every `satisfies` name a skill that exists?"
    And it answers "Yes — all **<n>**"

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_generator_writes_where_the_declaration_says::and_the_committed_page_is_current
  Scenario: The committed Tools page is current
    Given the committed Tools page under the base docs layer (the test is skipped where the site is not built)
    When it is compared with the page published from all discovered Tools, with one subject per declaring instance
    Then they are identical

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_generator_writes_where_the_declaration_says::draws_one_current_page_per_instance_that_declares_Tools,_and_none_for_an_empty_graph
  Scenario: One current page is drawn per instance declaring Tools, and none for an empty graph
    Given the per-instance Tools pages (the test is skipped where the site is not built)
    When each subject's page is compared with its published page
    Then there is more than one subject
    And each page's path ends "/tools/<instance>/index.md" and is identical to its published page
    And no page exists for an instance whose tools graph is empty

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_generator_writes_where_the_declaration_says::draws_one_page_per_Tool,_carrying_its_IRI,_and_every_row_links_to_it
  Scenario: One page is drawn per Tool, carrying its IRI, and every row of the layer page links to it
    # Gap: the IRI itself is not checked, only that a JSON-LD script is present
    # Skipped: where the per-Tool pages are not built in this checkout
    Given the Tools pages drawn for every instance that declares Tools
    When each Tool row's own page is looked up
    Then every Tool has a page
    And that page has a "Tool" row naming its id, a JSON-LD script, a "Skills it satisfies" section and a "How it is deployed and reached" section
    And the layer's Tools page links the Tool's id to its page

  @test:test/coordinator/tools-viewer-checkout.test.ts::the_generator_writes_where_the_declaration_says::publishes_an_OpenAPI_document,_an_MCP_tool_list_and_an_API_reference_per_layer,_linked_from_its_page
  Scenario: Each layer publishes an OpenAPI document, an MCP tool list and an API reference, linked from its page
    # Skipped: where the API documents are not built in this checkout
    Given the Tools pages drawn for every instance that declares Tools
    When each layer's "openapi.json", "mcp-tools.json" and "api/index.md" are read
    Then the OpenAPI document is version "3.1.0" with exactly one path "/tools/<id>" per Tool
    And the MCP tool list holds a "tools" array
    And the API reference has an "## Operations" section
    And the layer's Tools page links "[OpenAPI document](openapi.json)"
