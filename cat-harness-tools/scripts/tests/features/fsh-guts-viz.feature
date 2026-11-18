# scripts/gen-fsh-guts-viz.ts lists the fsh-guts trashcan's files (gutsFiles) and renders its index page (page),
# reading sidecars for formats that cannot carry front matter and titles from markdown only.
# Each Scenario names the test that executes it.
Feature: The fsh-guts index page generator

  @test:scripts/tests/fsh-guts-viz.test.ts::a_sidecar_describes_ANY_format_that_cannot_carry_front_matter::not_just_the_.py/.ts/.sh_the_rule_used_to_list
  Scenario: A sidecar describes any non-markdown file, not only scripts
    Given a trashcan with a PDF, a JSON extraction record, an HTML page and a Python script, each beside a markdown sidecar
    When gutsFiles lists it
    Then "uploads/paper.pdf", "uploads/paper.pdf.extraction.json", "retired/page.html" and "scripts/tool.py" are each in state "sidecar"
    And the sidecar "uploads/paper.md" is in state "declared"

  @test:scripts/tests/fsh-guts-viz.test.ts::a_sidecar_describes_ANY_format_that_cannot_carry_front_matter::a_non-markdown_file_with_NO_sidecar_is_still_a_finding
  Scenario: A non-markdown file with no sidecar is undeclared
    Given a trashcan holding only "scripts/orphan.py"
    When gutsFiles lists it
    Then its state is "undeclared"

  @test:scripts/tests/fsh-guts-viz.test.ts::a_title_is_read_from_markdown_only::binary_is_never_scraped_for_a_heading
  Scenario: A binary file is never scraped for a heading
    Given a trashcan holding a PDF whose bytes contain a "# Not a heading" line
    When gutsFiles lists it
    Then the row is "uploads/x.pdf"
    And it has no title

  @test:scripts/tests/fsh-guts-viz.test.ts::a_title_is_read_from_markdown_only::a_markdown_node_still_yields_its_heading
  Scenario: A markdown node yields its heading as its title
    Given a trashcan holding a markdown node headed "A retired thing"
    When gutsFiles lists it
    Then its title is "A retired thing"

  @test:scripts/tests/fsh-guts-viz.test.ts::page_lede_and_links_(folio-assistant-oi3h)::lede_explains_count_relationship_with_interactive_viewer
  Scenario: The page lede explains the count relationship with the interactive viewer
    Given a declared markdown row and an undeclared script row
    When the page is rendered
    Then it contains "Count relationship:"
    And it contains "interactive viewer"
    And it contains "Settings → Discarded"

  @test:scripts/tests/fsh-guts-viz.test.ts::page_lede_and_links_(folio-assistant-oi3h)::file_links_are_marked_as_external_links_to_GitHub
  Scenario: File links on the page are marked as external links to GitHub
    Given one declared row
    When the page is rendered against a GitHub blob base
    Then it contains target "_blank" and rel "noopener noreferrer"
    And it contains the title "View on GitHub"
    And it contains the "↗" marker

  @test:scripts/tests/fsh-guts-viz.test.ts::an_existing,_empty_store::renders_an_index_that_says_0_file(s),_not_an_error
  Scenario: An empty trashcan renders an index that says 0 files
    When the page is rendered with no rows
    Then it contains "**0 file(s)** across 0 group(s)"
