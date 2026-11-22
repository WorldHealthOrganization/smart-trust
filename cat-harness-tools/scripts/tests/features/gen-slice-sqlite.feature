# scripts/gen-slice-sqlite.ts builds the content-addressed SQLite slices (beans, todos, library, kg) the site
# queries, storing payload pointers and FTS5 indexes rather than bodies. Each Scenario names the test that executes it.
Feature: SQLite slices of the beans, todos, library and knowledge graph

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_fixture::every_bean_is_a_row,_both_declarations_of_an_edge_are_kept,_and_a_duplicate_id_is_reported_rather_than_dropped
  Scenario: Every bean is a row, an edge declared on both sides is kept twice, and a duplicate id is reported
    Given five fixture beans where p-dddd has two files and p-bbbb blocks p-cccc which also declares p-bbbb as a blocker
    When the beans slice is built
    Then it has 5 bean rows and reports the duplicate id "p-dddd"
    And the bean edges number 3, with 3 bean_block rows, 2 blocked_by rows and 2 bean_tags rows
    And the blocked_by view lists p-aaaa and p-bbbb as the blockers of p-cccc

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_fixture::bodies_are_NOT_stored_—_the_slice_carries_the_payload_sha256_—_yet_FTS5_finds_a_phrase_in_a_body
  Scenario: Bean bodies are not stored, the payload sha256 is, and FTS5 still finds a phrase in a body
    Given the fixture beans written as source files
    When the beans slice is built
    Then the beans table has no "body" column
    And p-aaaa's payload_sha256 and payload_bytes are those of its source file verbatim, front matter included
    And an FTS match on "late materialization" finds only p-aaaa
    And an FTS match on the reversed phrase "materialization late" finds nothing

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_fixture::two_builds_are_byte-identical,_and_the_row_digest_read_back_equals_the_one_computed_from_the_beans
  Scenario: Two builds are byte-identical and the row digest read back equals the one computed from the beans
    Given the fixture beans in their original order and reversed
    When a beans slice is built from each
    Then both have the same sha256, the same file name and identical bytes
    And the content digest equals the one expected from the bean data
    And the digest read back from the database equals the built content digest

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_fixture::the_database_is_published_under_its_own_sha256,_and_the_manifest_names_that_file_(bean_`wixl`)
  Scenario: The database is published under its own sha256 and the manifest names that file
    # Gap: no manifest is written or read; only the built result's file name is checked
    Given the fixture beans
    When the beans slice is built
    Then the reported sha256 is the hash of the written file's bytes
    And the file is named "beans.<sha256>.sqlite3", matching sliceFileName and the SLICE_FILE pattern
    And the reported byte count is the file's size
    And the output directory holds exactly that one file
    And a build from a different set of beans gets a different file name

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_fixture::rotation_removes_this_slice's_earlier_builds_and_the_legacy_fixed_path,_and_nothing_else
  Scenario: Rotation removes only this slice's earlier builds and the legacy fixed path
    Given an older and a current beans build, a legacy "beans.sqlite3", its manifest, a todos slice file and an "index.json"
    When the beans slice files are rotated keeping the current build
    Then the removed files are the legacy "beans.sqlite3" and the older build
    And the current build, "beans.sqlite3.json", "index.json" and the todos slice file remain

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_fixture::a_slice_that_lost_a_row_does_not_match_the_store's_digest
  Scenario: A slice that lost a row does not match the store's digest
    Given the fixture beans with the first one dropped
    When the beans slice is built
    Then its content digest differs from the digest expected from the full fixture

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_fixture::bean_bodies_are_written_by_gen-subgraph-jsonld's_payload_writer_and_pass_its_orphan_audit
  Scenario: Bean payloads are written by the subgraph payload writer and pass its orphan audit
    Given the payload plan of the fixture beans
    Then it holds 4 payloads, since p-dddd's two identical files share one
    When the payloads are written
    Then 4 files are written and the orphan audit finds no problems
    And p-aaaa's link points at "https://example.org/site/payload/sha256/<sha256>"
    And the payload file holds p-aaaa's source file text

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_the_real_bean_store::rows_equal_the_bean_count,_and_a_known_bean_is_queryable_by_id_and_by_FTS
  Scenario: Over the real bean store, rows equal the bean count and a known bean is queryable by id and by FTS
    # Skipped: outside the aggregate checkout
    Given the real active and archived beans, more than 100 of them
    When the beans slice is built
    Then it has one row per bean
    And bean "folio-assistant-q8ar" is found by id with its title and status
    And an FTS match on "late materialization" includes that bean

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_the_real_bean_store::--check_is_green_over_the_store_as_it_is
  Scenario: --check is green over the real bean store
    # Skipped: outside the aggregate checkout
    Given the real active beans
    When the beans slice is checked
    Then there are no problems

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_the_slice_table::one_definition_per_slice,_each_naming_its_FTS_rows_among_its_tables_and_counting_every_table
  Scenario: Every slice definition names its FTS row table among its tables and counts every table
    Given the slice table
    Then it defines the slices beans, todos, library and kg in that order
    And each definition's FTS rows table is one of its tables, and every table is counted
    And each search select names the FTS row table's alias
    And each DDL creates a contentless fts5 virtual table

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_todos::every_published_todo_is_a_row;_a_todo_with_no_source_file_keeps_its_row,_has_no_payload,_and_is_a_finding
  Scenario: Every published todo is a row, and one with no source file keeps its row with no payload and is a finding
    # Skipped: the published todo index is not built
    Given a todo index of t-bbbb and t-aaaa where only t-aaaa has a source file
    When the todos slice is built
    Then it has 2 todo rows, t-aaaa then t-bbbb
    And the only finding says t-bbbb's source file was not found, row kept, no payload
    And t-aaaa's payload_sha256 is its source file's hash and t-bbbb's is null
    And an FTS match on "word positions" finds t-aaaa, while the todos table has no "comment" column
    And todo_relation has two rows per distinct relation of the template item

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_todos::--check_is_green_over_the_fixture,_and_the_row_digest_catches_a_lost_row
  Scenario: --check is green over the todos fixture, and the row digest catches a lost row
    # Skipped: the published todo index is not built
    Given the todos fixture data
    When it is checked
    Then there are no problems
    And a build with the first todo and its FTS row dropped has a content digest differing from the expected one

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_todos::the_real_index_slices_green,_every_todo_with_its_source_file
  Scenario: The real todo index slices green with every todo's source file
    # Skipped: the published todo index is not built, or outside the aggregate checkout
    Given the todos slice loaded from the repository
    Then it has one row per item in the published index
    And it has no findings and --check reports no problems

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_library::entries_and_blocks_are_rows;_a_block's_payload_is_its_PUBLISHED_entry_file;_gaps_are_findings,_not_drops
  Scenario: Library entries and blocks are rows, a block's payload is its published entry file, and gaps are findings
    # Skipped: the library projection is not built
    Given a library index of lib-b, lib-a and lib-c, and entry files for lib-a, lib-b and the unindexed lib-x
    When the library slice is built
    Then it has 3 entries, 3 blocks and the template's referencedBy count times 3 entry_ref rows
    And the findings say lib-x is not in the index and lib-c has no entry file
    And lib-a's blocks and entry row carry the sha256 of lib-a's entry file
    And an FTS match on "certainty of evidence" finds lib-a's block p1
    And an FTS match on the entry title "guideline development" finds both lib-a blocks
    And the blocks table has no "content" column, and the withheld block p2 has has_text 0
    And --check reports no problems

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_library::the_real_library_slices_green,_and_every_indexed_entry_is_a_row
  Scenario: The real library slices green with every indexed entry as a row
    # Skipped: the library projection is not built
    Given the library slice loaded from the repository
    Then it has one entry row per entry in the library index
    And --check reports no problems

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_kg::nodes_keyed_by_subject_path,_every_@id-typed_term_an_edge,_types_compacted,_a_dangling_target_reported_by_the_view
  Scenario: KG nodes are keyed by subject path, @id-typed terms are edges, types are compacted, and a dangling target is reported
    Given a JSON-LD document of skills b and a and package p, where b uses a missing skill, and a payload link for skill a
    When the kg slice is built
    Then it has 3 nodes, 4 edges and 1 dangling row
    And the nodes are "package/p", "skill/a" and "skill/b" with types "ex:Package" and "ex:Skill", only skill/a carrying a payload
    And the meta base is the document's directory
    And the incoming view lists skill/a and skill/b for package/p
    And the dangling view lists "skill/missing"
    And an FTS match on "without storing" finds skill/a
    And the probe is the phrase "materialization skill" in column iri with value "skill/b"

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_kg::a_sequence_flow_is_sliced_once:_its_from/to_are_edges,_the_nodes'_incoming/outgoing_mirrors_are_not,_and_the_view_answers_the_reverse
  Scenario: A sequence flow is sliced once, as from/to edges, and the view answers the reverse
    Given two process nodes whose incoming/outgoing name a flow, and the flow with from and to
    When the kg slice is built
    Then the only edges are the flow's "from" to node a and "to" to node b
    And the incoming view lists the flow under node a with rel "from"

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_kg::a_one-release_tombstone_is_not_a_row:_it_has_no_type_and_no_text,_only_a_forwarding_address_(bean_0exf)
  Scenario: A one-release tombstone is not a row
    Given the KG document plus a deprecated node with only isReplacedBy and sameAs
    When the kg slice is built
    Then it still has 3 nodes, 4 edges and 1 dangling row

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_kg::a_pointer_at_a_payload_the_published_tree_does_not_hold_fails_--check
  Scenario: A pointer at a payload the published tree does not hold fails --check
    Given a payload link for skill a and an empty published payload directory
    When the kg slice is checked against that directory
    Then a problem says the payload is one "which the published tree does not hold"

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_kg::the_whole-repo_KG_slices_green,_its_pointers_resolve_to_the_COMMITTED_payloads,_and_it_stays_under_the_budget
  Scenario: The whole-repo KG slices green with resolving pointers and stays under budget
    # Skipped: the published payload tree is not built
    Given the kg slice loaded from the repository
    Then it has more than 1000 nodes and more than 100 payload links
    And --check reports no problems
    And the built slice is not over budget

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_a_reached_but_empty_work-plan_store::an_empty_bean_store_still_refuses_--check,_so_building_it_is_not_applicable_rather_than_green
  Scenario: A reached but empty work-plan store is not applicable, not a refusal
    Given a bean store that was reached and holds no beans
    Then --check over it still reports that there is no row to probe FTS5 with
    And the beans and todos slices report it as not applicable, naming the empty store

  @test:scripts/tests/gen-slice-sqlite.test.ts::gen-slice-sqlite_—_a_reached_but_empty_work-plan_store::a_store_with_rows_is_sliced_as_before,_and_an_empty_content_slice_(library,_kg)_still_refuses
  Scenario: Only an empty work-plan store is excused
    Given a bean store with one bean
    Then it is sliced as before
    And an empty library or kg slice is not excused, so it still refuses
