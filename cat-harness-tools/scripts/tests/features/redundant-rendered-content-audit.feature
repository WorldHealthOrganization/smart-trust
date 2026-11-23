# The rendered-content bloat audit (bean folio-assistant-s32v): large markup
# repeated across rendered pages, or identical to a committed KG node, is a
# candidate to load from the KG instead. Each Scenario names the test that
# executes it.
Feature: Redundant rendered content is found and classified

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::redundant-rendered-content-audit_registration::criterion_is_registered_in_KG_CRITERIA_BY_ID_with_expected_properties
  Scenario: The criterion is registered with its scope basis
    Then the audit's criterion is registered, applies to "graph", is repo-scoped and "minor"
    And its scope basis is over 80 characters and names the repository-level measurement

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::extractHtmlBlocks::extracts_blocks_meeting_the_byte_threshold_with_selectors
  Scenario: Blocks over the byte threshold are extracted with selectors
    Given a page with a nav and a 25-row table of class "data-table artifact-grid"
    When its blocks are extracted with threshold 200
    Then there is a table block whose selector names "table" and "data-table", over 200 bytes, on "test.html"

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::extractHtmlBlocks::extracts_embedded_ld+json_scripts_even_below_generic_threshold
  Scenario: Embedded ld+json is extracted below the threshold
    Given a page whose head holds a small application/ld+json script
    When its blocks are extracted with threshold 500
    Then there is a script block containing "application/ld+json"

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::classification_logic_(move_vs_keep_serverside_vs_unsure)::classifies_navigation,_header,_footer,_and_search_as_keep_serverside
  Scenario: Navigation, header, breadcrumb and search are kept server-side
    Then a nav is "keep_serverside" for a reason mentioning "Navigation"
    And a header, a breadcrumb trail and a search form are "keep_serverside"

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::classification_logic_(move_vs_keep_serverside_vs_unsure)::classifies_headings,_document_identity,_and_noscript_as_keep_serverside
  Scenario: Headings and noscript are kept server-side
    # Gap: the title also names document identity; no identity block is classified.
    Then a page-title div is "keep_serverside"
    And a noscript is "keep_serverside" for a reason mentioning "No-JS fallback"

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::classification_logic_(move_vs_keep_serverside_vs_unsure)::classifies_heavy_data_tables_and_repeated_card_lists_as_move
  Scenario: Heavy data tables and repeated card lists move
    Then a data table is "move" for "tabular data"
    And a card list is "move" as a "Repeated component list"

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::classification_logic_(move_vs_keep_serverside_vs_unsure)::classifies_embedded_raw_JSON_/_code_blocks_and_KG-matched_blocks_as_move
  Scenario: Raw JSON dumps and KG-matched blocks move
    Then a pre.json-dump is "move" as a "Raw data dump"
    And a block matching "schemas/artifact.json" is "move" for a reason naming it

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::classification_logic_(move_vs_keep_serverside_vs_unsure)::classifies_ambiguous_generic_containers_without_clear_markers_as_unsure
  Scenario: A generic container is unsure
    Then a div.generic-container is "unsure", it "requires agentic/author review"

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::auditRenderedBloat_end-to-end_with_fixtures::vacuity_guard:_returns_'unknown'_when_0_HTML_files_exist
  Scenario: No HTML files is unknown
    Given an empty site directory
    When the audit runs and writes its sidecar
    Then it examined 0 pages and the criterion is "unknown", counted unknown not pass, with a finding naming the "vacuity guard"
    And the sidecar is written and validates as kg-qa

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::auditRenderedBloat_end-to-end_with_fixtures::detects_repeated_markup_blocks_across_multiple_HTML_pages_(>_threshold)
  Scenario: Markup repeated across pages is found
    Given two pages each holding the same table of over 500 bytes
    When the audit runs with threshold 400 and minimum occurrences 2
    Then it examined 2 pages, over 1000 bytes, with candidates
    And a "move" candidate occurs twice, on page1.html and page2.html
    And the criterion fails with a finding on page1.html
    And the sidecar is written and validates as kg-qa

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::auditRenderedBloat_end-to-end_with_fixtures::detects_KG-identical_content_embedded_in_HTML
  Scenario: Content identical to a KG node is found
    Given a committed KG JSON file and a page embedding the same JSON
    When the audit runs with minimum occurrences 1
    Then it examined 1 page and a candidate matched to sample-spec.json is "move", naming the file

  @test:scripts/tests/redundant-rendered-content-audit.test.ts::auditRenderedBloat_end-to-end_with_fixtures::sidecar_output_conforms_to_schemas/sdlc/kg-qa.ts_when_all_candidates_are_keep_serverside_(pass)
  Scenario: A site with only server-side candidates passes with a valid sidecar
    Given two pages sharing only a nav block
    When the audit runs
    Then it examined 2 pages with no "move" candidates, and the criterion passes with no findings
    And the sidecar validates as kg-qa/v1 for graph subject "rendered-content-bloat"
