# A document's provenance log sits beside it and renders as a collapsed footer
# grouped by section. Each Scenario names the test that executes it.
Feature: The provenance footer

  @test:scripts/tests/provenance-footer.test.ts::provenance_footer::the_log_of_a_document_sits_beside_it
  Scenario: A document's log sits beside it
    Then the log of skills/a.md is skills/a.prov.jsonld, and of processes/p.bpmn is processes/p.prov.jsonld

  @test:scripts/tests/provenance-footer.test.ts::provenance_footer::reads_every_entry_and_skips_the_document_node;_a_missing_or_foreign_file_is_no_log
  Scenario: Every entry is read and the document node skipped; a missing or foreign file is no log
    Then the fixture's log reads three entries of kinds bean, pr and owner-decision, a single ref read as a list
    And a missing file and a file holding a bare array are no log

  @test:scripts/tests/provenance-footer.test.ts::provenance_footer::a_passage_cut_from_an_HTML_comment_loses_the_markers_and_the_indent
  Scenario: A passage cut from an HTML comment loses the markers and the indent
    Then a multi-line comment keeps only its relative indent
    And a comment closed with --!> loses its markers
    And entities are decoded once

  @test:scripts/tests/provenance-footer.test.ts::provenance_footer::emphasis_becomes_tags_outside_code_spans_only
  Scenario: Emphasis becomes tags outside code spans only
    Then bold and italic become strong and em, but not inside code
    And arithmetic asterisks are left alone

  @test:scripts/tests/provenance-footer.test.ts::provenance_footer::renders_collapsed,_grouped_by_section,_escaped,_inside_a_raw_block
  Scenario: The footer renders collapsed, grouped by section, escaped, inside a raw block
    When the fixture's entries are rendered
    Then it is a closed details element counting 3, with two sections in order Why then How
    And markup in a value is escaped, backticked references become code, it starts with a raw tag, and holds no comment markers

  @test:scripts/tests/provenance-footer.test.ts::provenance_footer::writes_a_fragment_and_an_index_entry_only_for_pages_with_entries,_and_prunes_stale_fragments
  Scenario: A fragment and an index entry are written only for pages with entries, and stale fragments pruned
    When the listing is written for one page with a log and one without
    Then one page and three entries are written, the index maps only that page to its fragment, and the fragment exists
    And when written again with no pages the fragment is reported stale and removed

  @test:scripts/tests/provenance-footer.test.ts::provenance_footer::under_check,_nothing_is_written_and_a_stale_fragment_is_reported,_not_deleted
  Scenario: Under check nothing is written and a stale fragment is reported, not deleted
    Given a written fragment
    When the listing is checked with no pages
    Then the fragment is reported stale and still exists

  @test:scripts/tests/provenance-footer.test.ts::provenance_footer::a_page_Jekyll_never_reads_gets_the_section_without_raw_tags;_no_log_gives_nothing
  Scenario: A page Jekyll never reads gets the section without raw tags; no log gives nothing
    Then without Liquid the section starts with details and has no raw tag
    And with Liquid it starts with a raw tag
    And a file with no log gets an empty section
