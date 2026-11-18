# scripts/check-derived-from.ts judges the derivedFrom edges between declared directories: resolution,
# order, cycles, the layering-gap ratchet, writers and the storage clock. Each Scenario names the test that executes it.
Feature: derivedFrom edges between derived directories

  @test:scripts/tests/check-derived-from.test.ts::resolution::an_id_resolves_to_the_NEAREST_declaring_instance,_and_the_edge_says_which
  Scenario: An id resolves to the nearest declaring instance
    Given instances base, mid and top, where top needs mid then base and both mid and base declare "lib"
    And top's "pages" is derived from "lib" and "chrome"
    When the world is judged
    Then there are no findings
    And the edges run from "top/pages" to "mid/lib" and to "base/chrome"

  @test:scripts/tests/check-derived-from.test.ts::resolution::an_id_declared_nowhere_is_refused
  Scenario: An id no instance declares is refused
    Given top's "pages" is derived from "nothing"
    When the world is judged
    Then the only finding is "unknown-id" for top's "pages" targeting "nothing"

  @test:scripts/tests/check-derived-from.test.ts::resolution::an_id_only_a_non-needed_instance_declares_is_a_LAYERING_GAP,_not_an_unknown_id
  Scenario: An id declared only by an instance not needed is a layering gap
    Given top's "pages" is derived from "styling", which only the unneeded instance "side" declares
    When the world is judged
    Then the only finding is "layering-gap" for top's "pages" targeting "styling", declared by "side"

  @test:scripts/tests/check-derived-from.test.ts::the_interim_order:_declaration_order_is_rendering_order::a_consumer_declared_before_its_same-instance_source_is_refused
  Scenario: A consumer declared before its same-instance source is refused
    Given top declares "pages" derived from "ast" before it declares "ast"
    When the world is judged
    Then the only finding is of kind "order"

  @test:scripts/tests/check-derived-from.test.ts::the_interim_order:_declaration_order_is_rendering_order::the_same_pair_in_source-first_order_passes
  Scenario: A source declared before its consumer passes
    Given top declares "ast" before "pages", which is derived from "ast"
    When the world is judged
    Then there are no findings

  @test:scripts/tests/check-derived-from.test.ts::cycles::a_two-node_cycle_is_refused_once
  Scenario: A two-node cycle is reported once
    Given top's "a" is derived from "b" and "b" from "a"
    When the world is judged
    Then exactly one finding is of kind "cycle"

  @test:scripts/tests/check-derived-from.test.ts::cycles::a_self-edge_is_a_cycle
  Scenario: A directory derived from itself is a cycle
    Given top's "a" is derived from "a"
    When the world is judged
    Then a finding of kind "cycle" is reported

  @test:scripts/tests/check-derived-from.test.ts::the_ratchet_over_layering_gaps::an_unbaselined_gap_regresses
  Scenario: A layering gap not in the baseline is a regression
    Given the layering-gap finding for top's "pages" targeting "styling"
    When it is ratcheted against an empty baseline
    Then there is one regression

  @test:scripts/tests/check-derived-from.test.ts::the_ratchet_over_layering_gaps::a_baselined_gap_passes
  Scenario: A layering gap in the baseline passes
    Given the same gap and a baseline entry naming it
    When it is ratcheted
    Then there are no regressions and no stale entries

  @test:scripts/tests/check-derived-from.test.ts::the_ratchet_over_layering_gaps::a_baseline_entry_that_is_no_longer_a_gap_is_stale
  Scenario: A baseline entry with no matching gap is stale
    Given no findings and a baseline entry for top's "pages" targeting "styling"
    When they are ratcheted
    Then that entry is reported stale

  @test:scripts/tests/check-derived-from.test.ts::advisory::a_derived_directory_naming_no_derivedFrom_is_counted,_not_refused
  Scenario: A derived directory with no derivedFrom is counted as undeclared, not refused
    Given top's derived "pages" names no derivedFrom
    When the world is judged
    Then there are no findings
    And "top/pages" is listed as undeclared

  @test:scripts/tests/check-derived-from.test.ts::this_checkout::reads_every_instance_and_finds_nothing_hard
  Scenario: The real checkout has no findings other than layering gaps
    Given this checkout's instances
    When they are analysed
    Then every finding is a layering gap

  @test:scripts/tests/check-derived-from.test.ts::this_checkout::resolves_scope:_'repository'_directories_against_the_checkout_root,_not_the_declaring_instance
  Scenario: Repository-scoped directories resolve against the checkout root
    Given this checkout's instance tree
    When the cat-harness instance is read
    Then its "beans" path is "beans/"
    And its "todos" path is "todos/"
    And its "health" path is "test/health/results/"

  @test:scripts/tests/check-derived-from.test.ts::the_rendering_order,_derived_from_the_edges::puts_a_source_before_its_consumer_even_when_the_consumer_is_declared_first
  Scenario: The rendering order puts a source before a consumer declared first
    Given top declares "pages" derived from "ast" before "ast"
    When the rendering order is derived from the judged edges
    Then "top/ast" comes before "top/pages"

  @test:scripts/tests/check-derived-from.test.ts::the_rendering_order,_derived_from_the_edges::agrees_with_the_interim_order_when_the_gate_passes
  Scenario: The rendering order matches declaration order when the gate passes
    Given top declares "ast" and then "pages" derived from "ast" and "chrome"
    When the rendering order is derived from the judged edges
    Then it equals every instance's directories in declaration order

  @test:scripts/tests/check-derived-from.test.ts::the_rendering_order,_derived_from_the_edges::leaves_a_cycle's_members_out
  Scenario: The rendering order leaves out the members of a cycle
    Given top's "a" and "b" are derived from each other
    When the rendering order is derived from the judged edges
    Then neither "top/a" nor "top/b" is in it

  @test:scripts/tests/check-derived-from.test.ts::downstream_of_a_change::is_transitive_and_in_rendering_order
  Scenario: What lies downstream of a change is transitive and in rendering order
    Given top's "ast" derived from "lib", "pages" derived from "ast", and an unrelated "other"
    When the downstream of "mid/lib" is computed
    Then it is "mid/lib", "mid/index", "top/ast" and "top/pages", in that order

  @test:scripts/tests/check-derived-from.test.ts::downstream_of_a_change::carries_nothing_a_change_cannot_reach
  Scenario: A change reaches nothing beyond its dependants
    Given the same world
    When the downstream of "top/pages" is computed
    Then it is only "top/pages"

  @test:scripts/tests/check-derived-from.test.ts::this_checkout's_IG_pages::re-render_when_smart-base's_chrome_changes
  Scenario: IG pages re-render when smart-base's themes change
    # Skipped: unless fhir-harness, smart-base and smart-trust are checked out alongside
    Given this checkout's instance tree
    When the downstream of "smart-base/smart-base-themes" is computed
    Then it includes "smart-base/smart-base-docs" and "smart-trust/smart-trust-docs"

  @test:scripts/tests/check-derived-from.test.ts::writer::a_writer_path_that_does_not_exist_is_refused
  Scenario: A writer path that does not exist is refused
    Given top's "pages" names the writer "gen/missing.ts" and no writer file exists
    When the world is judged
    Then the only finding is "missing-writer" for top's "pages" naming "gen/missing.ts"

  @test:scripts/tests/check-derived-from.test.ts::writer::this_checkout's_IG_page_sets_name_gen-ig-pages_as_their_writer
  Scenario: The checkout's IG page sets name gen-ig-pages as their writer
    # Skipped: unless fhir-harness, smart-base and smart-trust are checked out alongside
    Given this checkout's instance tree
    When the "<ig>-docs" directories that name a writer are collected
    Then smart-base and smart-trust are among them
    And every one's writer includes "fhir-harness/scripts/gen-ig-pages.ts"

  @test:scripts/tests/check-derived-from.test.ts::the_storage_clock::a_COMMITTED_viewer_of_a_branch-kept_graph_is_refused,_naming_the_chain
  Scenario: A committed viewer of a branch-kept directory is refused, naming the chain
    Given top's "guts" is kept on a branch and has a viewer "docs/guts/index.md" with a writer
    And that viewer file is committed
    When the world is judged
    Then the only finding is "committed-from-branch" for "guts", artefact "docs/guts/index.md", via "top/guts"

  @test:scripts/tests/check-derived-from.test.ts::the_storage_clock::an_untracked_viewer_with_a_writer_is_built_at_publish,_and_is_not_a_finding
  Scenario: An untracked viewer with a writer is built at publish
    Given the same branch-kept "guts" with a viewer that has a writer, and nothing committed
    When the world is judged
    Then there are no findings
    And the publish list holds the viewer, its writer "gen/guts.ts" and the chain "top/guts"

  @test:scripts/tests/check-derived-from.test.ts::the_storage_clock::an_untracked_viewer_with_NO_writer_is_refused:_nothing_would_build_it
  Scenario: An untracked viewer with no writer is refused
    Given the branch-kept "guts" with a viewer that names no writer, and nothing committed
    When the world is judged
    Then the only finding is of kind "publish-without-writer"

  @test:scripts/tests/check-derived-from.test.ts::the_storage_clock::the_clock_is_TRANSITIVE:_a_committed_directory_derived_from_a_branch-kept_one_is_refused
  Scenario: A committed directory derived from a branch-kept one is refused
    Given "report" is derived from the branch-kept "guts", has a writer, and its path "report/" is committed
    When the world is judged
    Then the only finding is "committed-from-branch" for "report", via "top/report" then "top/guts"

  @test:scripts/tests/check-derived-from.test.ts::the_storage_clock::and_a_viewer_of_THAT_directory_is_publish-time_too,_through_the_edge
  Scenario: A viewer of a directory derived from a branch-kept one is built at publish
    Given "report", derived from the branch-kept "guts", has a viewer with a writer, and nothing committed
    When the world is judged
    Then the publish list includes "docs/guts/index.md" via "top/report" then "top/guts"

  @test:scripts/tests/check-derived-from.test.ts::the_storage_clock::nothing_kept_on_a_branch_means_nothing_is_publish-time,_and_a_committed_viewer_is_fine
  Scenario: With nothing kept on a branch, a committed viewer is fine
    Given "guts" is not on a branch and has a committed viewer with a writer
    When the world is judged
    Then there are no findings
    And nothing is publish-time

  @test:scripts/tests/check-derived-from.test.ts::the_storage_clock::this_checkout:_the_fsh-guts_viewer_is_built_at_publish_and_nothing_committed_derives_from_a_branch
  Scenario: The checkout's fsh-guts viewer is built at publish
    # Skipped: unless the root layer's folio-assistant.json is checked out alongside
    Given this checkout's instances
    When they are analysed
    Then there is no "committed-from-branch" or "publish-without-writer" finding
    And the publish list includes "cat-harness/docs/fsh-guts/index.md"
