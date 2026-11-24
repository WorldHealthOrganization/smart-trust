# scripts/gen-caches-viz.ts renders the caches viewer page: each cache node's implied key
# where it can be computed, its stored state from the daily report, and whether it is stale.
# Each Scenario names the test that executes it.
Feature: Caches viewer

  @test:scripts/tests/gen-caches-viz.test.ts::impliedKey::hashFiles_is_the_runner's:_sha256_over_each_file's_raw_sha256,_in_path_order
  Scenario: hashFiles matches the runner's sha256 of raw file digests in path order
    Given a directory with files "a" holding "A" and "b" holding "B"
    When hashFiles is computed over "b" and "a"
    Then it equals the sha256 of the raw sha256 of "A" followed by that of "B"

  @test:scripts/tests/gen-caches-viz.test.ts::impliedKey::what_cannot_be_computed_here_says_why,_never_a_value
  Scenario: A key that cannot be computed here says why instead of giving a value
    Given key recipes of source "per-run", "hand-listed", "script" and "cache:key"
    When each implied key is computed
    Then each result is an object rather than a key string
    And a hashFiles recipe over a missing "absent.json" is undetermined with "absent.json is not a file in this checkout"

  @test:scripts/tests/gen-caches-viz.test.ts::render::a_node_that_does_not_parse_is_listed_as_refused,_not_dropped
  Scenario: A cache node that does not parse is listed as refused
    Given a caches directory holding an incomplete "bad.cache.json"
    When the caches are loaded and rendered
    Then the refused list is exactly "bad.cache.json"
    And the page contains a "## Refused" section

  @test:scripts/tests/gen-caches-viz.test.ts::render::without_a_report_every_stored_cell_says_where_it_comes_from;_with_one,_staleness_is_computed
  Scenario: Stored cells name their source without a report and show staleness with one
    Given a valid actions-cache node "demo" keyed by hashFiles over "lock.json"
    When it is rendered without a report
    Then the page says "from the daily report (not read)"
    And it says "undetermined — no stored key read"
    And with a report whose stored key matches the implied key the row says "current"
    And with a report holding an old key the row says "**stale**"

  @test:scripts/tests/gen-caches-viz.test.ts::the_committed_viewer.md_is_current
  Scenario: The committed viewer page is current
    Given the layer's cache nodes
    When the viewer is rendered without a report
    Then it equals the committed viewer.md followed by a newline

  @test:scripts/tests/gen-caches-viz.test.ts::retired_cat-mount-v1-_Actions_cache_steps_stay_out_of_workflows_and_declared_caches_(bean_9ml4)
  Scenario: Retired cat-mount-v1- Actions cache steps stay out of workflows and declared caches
    Given the layer's ci-setup action, layer-pr-checks.yml, pr-tests.yml and declared cache nodes
    Then none of those workflows or actions contains a "cat-mount-v1-" cache key
    And the declared cache nodes carry neither "lpc-cat-mount" nor location "cat-mount-v1-"

  @test:scripts/tests/gen-caches-viz.test.ts::storedFromReport_—_the_daily_report's_raw_facts,_matched_by_location::the_stored_key_is_main's_newest_entry_under_the_location,_size_is_every_entry's
  Scenario: The stored key is main's newest entry under the location and size sums every entry
    Given a daily report with two "derive-cache-v1-" entries, one on a pull request and one on main, and a hit rate of 0.5
    When the stored state of a node at location "derive-cache-v1-" is read
    Then its key is the main entry "derive-cache-v1-b"
    And its size is 30 bytes, its last access is main's entry time, and its hit rate is 0.5

  @test:scripts/tests/gen-caches-viz.test.ts::storedFromReport_—_the_daily_report's_raw_facts,_matched_by_location::a_node_of_another_kind_gets_nothing_from_the_Actions-cache_report
  Scenario: A node of another kind gets nothing from the Actions-cache report
    Given the daily report and a "git-ref" node at a matching location
    When the stored state is read
    Then it is empty

  @test:scripts/tests/gen-caches-viz.test.ts::storedFromReport_—_the_daily_report's_raw_facts,_matched_by_location::a_node_with_no_entry_stays_absent_(its_cells_stay_undetermined)
  Scenario: A node with no report entry stays absent
    Given the daily report and a node at location "nothing-"
    When the stored state is read
    Then it is empty

  @test:scripts/tests/gen-caches-viz.test.ts::storedFromReport_—_the_daily_report's_raw_facts,_matched_by_location::an_already-resolved_map_passes_through
  Scenario: An already-resolved stored map passes through
    Given a map already resolved to node "x" with key "k"
    When the stored state is read from it
    Then the same map is returned

  @test:scripts/tests/gen-caches-viz.test.ts::a_table_cell_escapes_backslashes_before_pipes,_so_a_trailing_backslash_cannot_un-escape_a_pipe
  Scenario: A table cell escapes backslashes before pipes
    Given cell text with a backslash before a pipe
    When it is escaped as a table cell
    Then the backslash is doubled and the pipe is escaped
    And a bare pipe is escaped
    And a CRLF line break becomes a single space
