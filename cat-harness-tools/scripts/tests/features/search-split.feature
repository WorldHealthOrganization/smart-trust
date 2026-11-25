# search-split: the site index cut into one index per scope. Every entry lands
# in exactly one scope, the scope rule reads declared facts, and the output is
# the same bytes for the same index. Each Scenario names the test that executes it.
Feature: Splitting the site search index by scope

  @test:scripts/tests/search-split.test.ts::scopeOf::an_instance_route_is_that_instance's_scope
  Scenario: An instance route is that instance's scope
    Given instances smart-trust and who-iris and locales fr and ar
    Then "/smart-trust/artifacts.html#x" is in instance scope "smart-trust"

  @test:scripts/tests/search-split.test.ts::scopeOf::a_kind_route_(/<kind>/<instance>/…)_is_the_instance's_scope_too
  Scenario: A kind route is the instance's scope
    Then "/library/who-iris/item.html" is in instance scope "who-iris"

  @test:scripts/tests/search-split.test.ts::scopeOf::a_target-locale_prefix_is_that_locale's_scope
  Scenario: A target-locale prefix is that locale's scope
    Then "/fr/getting-started.html" is in locale scope "locale-fr"

  @test:scripts/tests/search-split.test.ts::scopeOf::anything_else_is_the_platform's
  Scenario: Anything else is the platform's scope
    Then "/", "/reference/x.html", "/es/page.html" and "" are all in the platform scope

  @test:scripts/tests/search-split.test.ts::scopeOf::the_first_segment_wins_over_the_second
  Scenario: The first path segment wins
    Then "/fr/smart-trust/x.html" is in scope "locale-fr"

  @test:scripts/tests/search-split.test.ts::split::partitions:_every_entry_in_exactly_one_scope,_keys_kept
  Scenario: Splitting partitions the index
    Given an index of six entries, one with no URL
    When it is split
    Then the union of the scopes' keys is exactly the index's keys
    And smart-trust holds 1 and 2, and the platform holds 0 and 5

  @test:scripts/tests/search-split.test.ts::render::the_manifest_names_every_scope_file_and_partitions_the_source
  Scenario: The manifest names every scope file and partitions the source
    When the six-entry index is rendered
    Then the manifest has the manifest schema, the source path and 6 source entries
    And the scopes' entry counts sum to 6, each matching its file's entries and bytes
    And the scope ids are _platform, locale-fr, smart-trust and who-iris

  @test:scripts/tests/search-split.test.ts::render::deterministic:_the_same_index_gives_the_same_bytes
  Scenario: Rendering is deterministic
    When the same index is rendered twice
    Then the files are identical

  @test:scripts/tests/search-split.test.ts::render::scope_files_key_entries_by_URL_hash,_unique_across_scopes
  Scenario: Scope files key entries by URL hash
    When the index is rendered
    Then the 6 keys across all scope files are unique hex hashes, optionally suffixed
    And entry 1's key is the truncated sha256 of "/smart-trust/index.html"

  @test:scripts/tests/search-split.test.ts::render::the_same_URL_twice_gets_distinct_keys,_first_in_source_order_keeps_the_bare_hash
  Scenario: Repeated URLs get suffixed keys
    Given three entries with the same URL
    Then the first keeps the bare hash and the others get -2 and -3

  @test:scripts/tests/search-split.test.ts::render::a_page_added_to_one_scope_leaves_every_other_scope's_files_byte_for_byte
  Scenario: Adding a platform page changes only the platform file and manifest
    Given the index with a new platform page inserted first, renumbering every entry
    When it is rendered
    Then only _platform.json and manifest.json differ from before

  @test:scripts/tests/search-split.test.ts::render::the_source_hash_changes_with_the_source
  Scenario: The source hash follows the source
    When an index with one more entry is rendered
    Then its manifest's source sha256 differs

  @test:scripts/tests/search-split.test.ts::the_CLI::writes,_then_--check_is_current;_a_changed_scope_file_is_stale
  Scenario: The CLI writes, checks current, and finds a changed file stale
    Given a site directory holding the theme's search index
    When the CLI writes the split
    Then it exits 0 and --check exits 0
    And after one scope file is overwritten --check exits 1

  @test:scripts/tests/search-split.test.ts::the_CLI::a_tree_with_no_index_is_refused,_not_split_into_nothing
  Scenario: The CLI refuses a tree with no index
    When the CLI runs on an empty directory
    Then it exits 1

  @test:scripts/tests/search-split.test.ts::platform_sections_over_the_budget_—_bean_mm2n::sectionOfPath:_below_a_section,_or_its_index;_never_a_page_at_the_root
  Scenario: The section of a path
    Then "/reference/skills.html", "/reference/" and "/reference/a/b.html" are in section "reference"
    And "/getting-started.html" and "/" have no section

  @test:scripts/tests/search-split.test.ts::platform_sections_over_the_budget_—_bean_mm2n::a_section_over_the_budget_becomes_its_own_scope,_index_page_included
  Scenario: A section over the budget becomes its own scope
    Given a 600-byte section budget that the reference section exceeds
    When the index is split
    Then "section-reference" is a section scope holding entries 1 and 2

  @test:scripts/tests/search-split.test.ts::platform_sections_over_the_budget_—_bean_mm2n::a_section_under_it,_and_pages_at_the_root,_stay_in_the_platform
  Scenario: Small sections and root pages stay in the platform
    When the index is split at that budget
    Then the platform holds 0, 3 and 5
    And there is no "section-guides" scope

  @test:scripts/tests/search-split.test.ts::platform_sections_over_the_budget_—_bean_mm2n::instances_are_never_cut_into_sections,_and_the_partition_stays_exact
  Scenario: Instances are not sectioned and the partition stays exact
    When the index is split at that budget
    Then smart-trust holds entry 4
    And the union of all scopes' keys is exactly the index's keys

  @test:scripts/tests/search-split.test.ts::platform_sections_over_the_budget_—_bean_mm2n::the_default_budget_is_512_KiB,_and_render_threads_a_given_one_through_to_the_manifest
  Scenario: The section budget defaults to 512 KiB and reaches the manifest
    Then the default section budget is 512 KiB
    And rendering at 600 bytes gives only the section scope "section-reference"
    And rendering at the default gives no section scope

  @test:scripts/tests/search-split.test.ts::remote_identifier_lookups_—_bean_1br0::every_published_index_is_named,_with_its_entry_count_and_a_link_that_opens_it
  Scenario: Every published identifier lookup is listed
    Given a site with a lookup page and lookup indexes who-iris (10 entries) and b-other (3)
    When the published lookups are read
    Then they are b-other then who-iris, each with kind id-lookup, its link and entry count

  @test:scripts/tests/search-split.test.ts::remote_identifier_lookups_—_bean_1br0::no_lookup_page,_or_an_unreadable_index,_is_nothing_to_link_to
  Scenario: No lookup page or an unreadable index gives no lookups
    Then a site with no lookup page has no published lookups
    And a site whose lookup manifest is not JSON has none

  @test:scripts/tests/search-split.test.ts::remote_identifier_lookups_—_bean_1br0::render_puts_them_in_the_manifest,_and_leaves_the_key_out_when_there_are_none
  Scenario: Remote lookups go in the manifest only when present
    When the index is rendered with one remote lookup
    Then the manifest's remote equals that lookup
    And rendered without, the manifest has no "remote" key

  @test:scripts/tests/search-split.test.ts::prebuilt_indexes_for_scopes_over_the_token_budget_—_bean_lrzn::the_default_budget_is_128_Ki_tokens,_and_tokens_are_counted_over_the_theme's_three_fields
  Scenario: The token budget and token counting
    Then the default prebuilt token budget is 128 Ki
    And a document's tokens are counted over its title, content and URL, giving 6

  @test:scripts/tests/search-split.test.ts::prebuilt_indexes_for_scopes_over_the_token_budget_—_bean_lrzn::only_a_scope_OVER_the_budget_is_prebuilt,_and_the_manifest_names_its_index
  Scenario: Only a scope over the token budget is prebuilt
    Given a token budget equal to the platform scope's count, which smart-trust exceeds
    When the index is rendered
    Then the platform scope has no prebuilt index and no .idx.json file
    And smart-trust names its .idx.json path and byte size

  @test:scripts/tests/search-split.test.ts::prebuilt_indexes_for_scopes_over_the_token_budget_—_bean_lrzn::the_default_budget_prebuilds_nothing_small,_and_the_output_is_the_same_bytes_every_time
  Scenario: The default budget prebuilds nothing small and prebuilt output is deterministic
    Then rendering at the default budget prebuilds no scope
    And rendering twice at budget 0 gives identical files

  @test:scripts/tests/search-split.test.ts::prebuilt_indexes_for_scopes_over_the_token_budget_—_bean_lrzn::the_index_is_the_one_the_theme's_own_buildSearchIndex_builds,_and_loads_to_the_same_answers
  Scenario: The prebuilt index equals the theme's own build
    Given the theme's just-the-docs.js rendered through Liquid with the default separator
    When its buildSearchIndex builds the documents
    Then the theme's default separator is this module's separator
    And the prebuilt index serialises identically to the theme's
    And loaded through the theme it answers four queries as the theme's build does

  @test:scripts/tests/search-split.test.ts::splitSite_—_scoped_by_the_checkout_the_site_was_built_from_(who-iris_search,_2026-11-13)::writes_the_manifest_and_one_file_per_scope,_the_mounted_layers_each_a_scope_of_their_own
  Scenario: A checkout's mounted layers are each a scope
    Given a who-iris checkout mounting cat-harness and smart-base, and its built site index
    When the site is split
    Then the written manifest equals the returned one
    And the scopes are the platform with 2, cat-harness with 1 and smart-base with 1
    And who-iris is not a scope
    And each scope file's length is its recorded bytes
    And a --check split reports nothing stale

  @test:scripts/tests/search-split.test.ts::splitSite_—_scoped_by_the_checkout_the_site_was_built_from_(who-iris_search,_2026-11-13)::a_site_with_no_theme_index_is_nothing_to_split,_and_nothing_is_written
  Scenario: A site with no theme index is not split
    When a site with no index is split
    Then the result is undefined and no scopes directory is written

  @test:scripts/tests/search-split.test.ts::splitSite_—_scoped_by_the_checkout_the_site_was_built_from_(who-iris_search,_2026-11-13)::the_harness_is_the_checkout's_declared_cat-harness_layer;_with_none,_the_resolved_harness
  Scenario: The harness is the checkout's cat-harness layer, else the resolved one
    Then the harness root in the checkout is its cat-harness directory
    And in a bare directory it is the resolved HARNESS_ROOT
