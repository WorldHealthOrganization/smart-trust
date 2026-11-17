# The formal-edge source rules in pipeline/content-graph.ts: which sources count as
# elaborated, and how a cache's per-entry sources are summarised, for writer and reader alike.
# Each Scenario names the test that executes it.
Feature: Formal-edge source rules

  @test:pipeline/formal-source.test.ts::isElaborated::atlas_and_elaborated_are_elaborated;_scan_and_mixed_are_not
  Scenario: Atlas and elaborated sources are elaborated; scan and mixed are not
    When each source is tested for being elaborated
    Then "atlas" and "elaborated" are elaborated
    And "scan", "mixed", "editorial-only" and a missing source are not

  @test:pipeline/formal-source.test.ts::summarizeSources::an_empty_cache_is_scan:_nothing_elaborated_has_been_recorded
  Scenario: An empty cache summarises as scan
    Given a cache with no entries
    When its sources are summarised
    Then the summary is "scan"

  @test:pipeline/formal-source.test.ts::summarizeSources::a_single_source_is_itself
  Scenario: A single kind of source summarises as itself
    When the sources "atlas", "atlas" are summarised, the summary is "atlas"
    And "elaborated" alone summarises as "elaborated"
    And "scan", "scan" summarises as "scan"

  @test:pipeline/formal-source.test.ts::summarizeSources::an_entry_with_no_source_counts_as_scan,_as_the_reader_always_assumed
  Scenario: An entry with no source counts as scan
    When a single entry with no source is summarised, the summary is "scan"
    And an elaborated entry beside an entry with no source summarises as "mixed"

  @test:pipeline/formal-source.test.ts::summarizeSources::atlas_beside_elaborated_is_still_fully_elaborated,_never_mixed
  Scenario: Atlas beside elaborated is fully elaborated, never mixed
    When the sources "atlas" and "elaborated" are summarised
    Then the summary is "elaborated"
    And that summary counts as elaborated

  @test:pipeline/formal-source.test.ts::summarizeSources::any_scan_beside_an_elaborated_entry_is_mixed
  Scenario: Any scan beside an elaborated entry is mixed
    When "atlas" and "scan" are summarised, the summary is "mixed"
    And "elaborated", "scan" and "atlas" summarise as "mixed"
