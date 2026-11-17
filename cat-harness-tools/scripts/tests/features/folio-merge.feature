# scripts/folio-merge.ts merges the published folio graph with the reader's browser folio, a union keyed by id,
# and scripts/gen-folio-viz.ts carries that merge into the folio page. Each Scenario names the test that executes it.
Feature: Folio page merge of published and local items

  @test:scripts/tests/folio-merge.test.ts::mergeFolio_—_a_union_keyed_by_id::every_published_node_and_every_local_entry_is_a_row:_neither_side_is_dropped
  Scenario: Every published node and every local entry becomes a row
    Given published nodes "who-iris" and "new-sticky"
    And local entries "who-iris/who-iris" and a pin of "https://example.org/ch1#intro"
    When they are merged for instance "who-iris"
    Then the rows are "who-iris", "new-sticky" and the pin, in that order
    And the counts are 2 published, 2 local, 1 synced, 1 unsynced and 1 published-only

  @test:scripts/tests/folio-merge.test.ts::mergeFolio_—_a_union_keyed_by_id::the_published_copy_wins_for_content
  Scenario: The published copy wins for content
    Given the "who-iris" node published and also held locally with an old title and href
    When they are merged
    Then its row is "synced" under local key "who-iris/who-iris"
    And its title is the published summary "A catalogue by reference"
    And its href is "/who-iris/" taken from the published copy
    And its theme is "iris-sticky" and its chars 153

  @test:scripts/tests/folio-merge.test.ts::mergeFolio_—_a_union_keyed_by_id::the_local_copy_wins_for_the_reader's_own_state,_including_fields_the_merge_does_not_know
  Scenario: The local copy wins for the reader's own state
    Given the "who-iris" node held locally as shown, with a geometry, a zoom of 0.5 and kind "library"
    When they are merged
    Then its row is shown
    And its geometry is the local one
    And its layout is zoom 0.5
    And its kind is "library"

  @test:scripts/tests/folio-merge.test.ts::mergeFolio_—_a_union_keyed_by_id::a_newly_published_node_shows_even_though_the_browser's_folio_never_held_it
  Scenario: A newly published node is a row though no local entry holds it
    Given the published node "new-sticky" with no local entry
    When they are merged
    Then its row has status "published"
    And it has no local key and no shown state

  @test:scripts/tests/folio-merge.test.ts::mergeFolio_—_a_union_keyed_by_id::a_local-only_item_is_kept_and_marked_unsynced,_with_its_own_title_and_address
  Scenario: A local-only item is kept as unsynced with its own title and address
    Given a local pin entry with no published node
    When they are merged
    Then its row has status "unsynced"
    And its title is "Chapter 1. Introduction" and its href "https://example.org/ch1#intro", taken from the local copy
    And it is not shown and its source is "DTH-PHC"

  @test:scripts/tests/folio-merge.test.ts::mergeFolio_—_a_union_keyed_by_id::the_bare_id_and_pin:/bookmark:_forms_match_too;_nothing_else_is_guessed
  Scenario: Bare, pin and bookmark keys match a published id; other prefixes do not
    Given a local entry keyed "new-sticky", "pin:new-sticky" or "bookmark:who-iris/new-sticky"
    When each is merged with the published nodes
    Then the "new-sticky" row is "synced" under that key
    And given a local entry keyed "other/new-sticky"
    Then the "new-sticky" row stays "published"
    And "other/new-sticky" is its own "unsynced" row

  @test:scripts/tests/folio-merge.test.ts::mergeFolio_—_a_union_keyed_by_id::two_local_keys_for_one_published_id:_the_first_syncs,_the_second_stays_its_own_row
  Scenario: Of two local keys for one published id, only the first syncs
    Given local entries "who-iris" and "pin:who-iris"
    When they are merged with the published nodes
    Then exactly one "who-iris" row is "synced"
    And "pin:who-iris" is its own "unsynced" row
    And the local count is 2

  @test:scripts/tests/folio-merge.test.ts::mergeFolio_—_a_union_keyed_by_id::a_missing_or_malformed_side_is_empty,_not_an_error
  Scenario: A missing or malformed side counts as empty
    When both sides are null
    Then there are no rows
    When the local side is an array
    Then the local count is 0
    When the published side is undefined
    Then both local entries are unsynced
    When the only published node has an empty id and the only local entry is null
    Then there are no rows

  @test:scripts/tests/folio-merge.test.ts::mergeFolio_—_a_union_keyed_by_id::it_is_self-contained,_so_the_page_can_carry_it_by_toString
  Scenario: The merge function survives being carried as source text
    Given the source text of mergeFolio
    Then it holds no backtick
    When it is rebuilt from that text and run on the same inputs
    Then it returns the same result as the original

  @test:scripts/tests/folio-merge.test.ts::the_page_loads_both_sources::it_carries_the_merge_and_reads_the_reader's_folio_store
  Scenario: The folio page embeds the merge and names the reader's folio store
    Given the viewer page generated for instance "who-iris"
    Then it contains "var mergeFolio = function mergeFolio("
    And it sets FOLIO_KEY to "fa-folio-assets" and INSTANCE to "who-iris"
    And it holds a "merged" div with aria-live "polite"

  @test:scripts/tests/folio-merge.test.ts::the_page_loads_both_sources::the_projection_is_fetched_past_any_cache,_and_fetched_again_when_the_tab_returns
  Scenario: The page fetches the projection uncached and listens for changes
    # Gap: only the page source is checked; no fetch or event is run
    Given the viewer page generated for instance "who-iris"
    Then it fetches the stamped data href with cache "no-store"
    And it mentions "visibilitychange"
    And it adds a "storage" listener
    And it re-renders the merge on "fa:folio-changed"
