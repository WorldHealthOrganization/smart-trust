# scripts/gen-lsi-viz.ts draws the Indexing evidence page: a section per indexing method with its held
# evidence and the skills that apply it, plus the indexing skills that have no method yet.
# Each Scenario names the test that executes it.
Feature: The Indexing evidence page

  @test:scripts/tests/gen-lsi-viz.test.ts::the_Indexing_evidence_page::is_titled_for_what_it_is,_not_for_the_method
  Scenario: The page is titled "Indexing evidence" and rendered by the LSI viewer
    Given a fixture evidence model with the methods "lsi" and "correspondence-analysis"
    When the evidence page is drawn
    Then its front matter has the title "Indexing evidence"
    And it is "rendered-by: lsi-viewer"

  @test:scripts/tests/gen-lsi-viz.test.ts::the_Indexing_evidence_page::has_a_section_per_method,_with_its_evidence_and_the_skills_that_apply_it
  Scenario: Each method has a section with its evidence and the skills that apply it
    Given a fixture method "lsi" with two held sources and the skill "lsi-indexing"
    When the evidence page is drawn
    Then it has the heading "### Latent Semantic Indexing {#lsi}"
    And it lists the source "library/deerwester-1990-indexing-by-lsa"
    And a table row names the skill "lsi-indexing" with its instance "cat-harness"
    And the row lists the tools "lsi-index" and "lsi-query" and the process "document-ingestion"

  @test:scripts/tests/gen-lsi-viz.test.ts::the_Indexing_evidence_page::a_method_with_no_held_source_and_no_skill_says_both,_rather_than_drawing_nothing
  Scenario: A method with no held source and no skill says both
    Given a fixture method "correspondence-analysis" with no evidence and no skills
    When the evidence page is drawn
    Then the page says "No held evidence."
    And it says nothing declares "uses-methodology: correspondence-analysis"

  @test:scripts/tests/gen-lsi-viz.test.ts::the_Indexing_evidence_page::an_indexing_skill_with_no_method_is_listed_as_having_no_evidence_yet
  Scenario: An indexing skill with no method is listed as having no evidence yet
    Given a fixture skill "glossary-terms" that names no method and uses the tool "glossary-from-source"
    When the evidence page is drawn
    Then the section "Indexing work with no evidence yet" names "glossary-terms"
    And it names its tool "glossary-from-source"

  @test:scripts/tests/gen-lsi-viz.test.ts::the_Indexing_evidence_page::points_index_health_at_the_repository_health_report
  Scenario: Index health is left to the repository health report
    Given the fixture evidence model
    When the evidence page is drawn
    Then it points the reader at the check "lsi-indexes"
    And it carries no "| graph | needs one |" health row

  @test:scripts/tests/gen-lsi-viz.test.ts::the_Indexing_evidence_page::every_table_row_has_as_many_cells_as_its_header_—_a_`|`_in_a_description_is_escaped
  Scenario: Every table row has as many cells as its header, with a pipe in a description escaped
    Given a fixture skill whose description contains "index | with a pipe"
    When the evidence page is drawn
    Then the description appears as "index \| with a pipe"
    And every row of each table has the same number of cells as the table's first row

  @test:scripts/tests/gen-lsi-viz.test.ts::the_evidence_page_links_the_keyword_viewer::a_reader_on_the_LSI_page_can_reach_the_Keywords_page_beneath_it
  Scenario: The evidence page links the Keywords page beneath it
    Given an evidence model with no methods and no unbacked skills
    When the evidence page is drawn
    Then it contains the link "[Keywords](keywords/)"
