# pipeline/qa-graph-integrity.ts checks that every file in every declared qa
# directory parses and holds no merge conflict marker.
# Each Scenario names the test that executes it.
Feature: QA directory integrity

  @test:pipeline/qa-graph-integrity.test.ts::checkQaFile::finds_an_8-wide_conflict_marker_in_a_hosted_home,_and_names_the_line
  Scenario: An 8-wide conflict marker in a hosted home is found, with its line
    Given a file "bootstrap/kg-qa/skills/x.kg-qa.json" holding a rename conflict with 8-wide markers
    When the file is checked
    Then the problem is "conflict-marker"
    And the detail names "line 4"

  @test:pipeline/qa-graph-integrity.test.ts::checkQaFile::finds_a_marker_in_a_non-JSON_document_too,_where_no_parser_would_trip
  Scenario: A conflict marker in a non-JSON document is found
    Given a Markdown file "notes.md" holding 7-wide conflict markers
    When the file is checked
    Then the problem is "conflict-marker"

  @test:pipeline/qa-graph-integrity.test.ts::checkQaFile::reports_unparseable_JSON_that_carries_no_marker
  Scenario: Unparseable JSON with no marker is reported
    Given a file "a.qa.json" holding '{ "x": 1, }'
    When the file is checked
    Then the problem is "unparseable-json"

  @test:pipeline/qa-graph-integrity.test.ts::checkQaFile::does_not_mistake_a_setext_underline,_or_a_marker_inside_a_string,_for_a_conflict
  Scenario: A setext underline or a marker inside a string is not a conflict
    Given a Markdown heading underlined with "======="
    And a JSON file whose string value contains "<<<<<<< HEAD"
    When each file is checked
    Then neither has a finding

  @test:pipeline/qa-graph-integrity.test.ts::checkQaFile::skips_binary_files
  Scenario: Binary files are skipped
    Given a binary file "img.png"
    When the file is checked
    Then there is no finding

  @test:pipeline/qa-graph-integrity.test.ts::checkQaFile::the_marker_pattern_matches_widths_7_and_8,_and_not_6
  Scenario: The conflict marker pattern matches widths 7 and 8 but not 6
    Given the conflict marker pattern
    Then the pattern matches "<<<<<<< HEAD", "<<<<<<<< HEAD:x" and ">>>>>>>"
    And it does not match "<<<<<< HEAD"

  @test:pipeline/qa-graph-integrity.test.ts::checkQaDirs::walks_nested_hosted_homes_and_counts_what_it_examined
  Scenario: Nested qa directories are walked once, counting the files examined
    Given a tree with a clean "kg-qa/skills/ok.kg-qa.json" and a conflicted "bootstrap/kg-qa/skills/bad.kg-qa.json"
    When the tree and its overlapping "bootstrap" subdirectory are both checked
    Then 2 files are examined
    And the only finding is "bootstrap/kg-qa/skills/bad.kg-qa.json", reported once

  @test:pipeline/qa-graph-integrity.test.ts::the_qa_directories_declared_in_this_checkout::includes_cat-harness's,_whose_walk_covers_the_hosted_bootstrap_homes
  Scenario: The declared qa directories include cat-harness's results and attestations
    Given the qa directories declared in this checkout
    Then they include "cat-harness/test/results" and "cat-harness/test/attestations"
    And the attestation directories are exactly the declared ones ending in "attestations"
    And checking the attestation directories examines at least one file

  @test:pipeline/qa-graph-integrity.test.ts::the_qa_directories_declared_in_this_checkout::the_attestation_store_holds_no_conflict_marker_and_no_unparseable_JSON
  Scenario: The attestation store holds no conflict marker and no unparseable JSON
    Given the attestation directories declared in this checkout
    When they are checked
    Then there are no findings
