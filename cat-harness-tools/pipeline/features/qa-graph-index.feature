# pipeline/qa-graph-index.ts projects the qa graph into separate per-family
# panels, classified by each file's $schema, and never into one cross-family total.
# Each Scenario names the test that executes it.
Feature: QA graph projection by family

  @test:pipeline/qa-graph-index.test.ts::the_ruling_is_the_SHAPE_—_no_cross-family_total_exists_to_publish::publishes_no_verdict_field_above_the_families
  Scenario: The index publishes no verdict field above the families
    Given a qa graph with one "kg-qa/v1" and one "qa-witness/v1" document
    When the qa graph is read
    Then the index's keys are exactly "$schema", "families", "files", "unclassified" and "unreadable"
    And it has none of "totals", "counts", "buckets", "total", "state", "verdict" or "summary"

  @test:pipeline/qa-graph-index.test.ts::the_ruling_is_the_SHAPE_—_no_cross-family_total_exists_to_publish::keeps_each_family's_own_bucket_spelling_apart,_and_never_merges_them
  Scenario: Each family keeps its own bucket spelling
    Given a "kg-qa/v1" document with totals pass 1 and "n/a" 4
    And a "qa-witness/v1" document with counts pass 1, "na" 7 and warn 2
    When the qa graph is read
    Then the "kg-qa/v1" buckets are pass 1 and "n/a" 4
    And the "qa-witness/v1" buckets are pass 1, "na" 7 and warn 2
    And the "kg-qa/v1" buckets have no "warn"

  @test:pipeline/qa-graph-index.test.ts::the_ruling_is_the_SHAPE_—_no_cross-family_total_exists_to_publish::reports_WHICH_field_a_family_rolled_up_from_—_they_differ
  Scenario: Each family reports the field it rolled up from
    Given a "kg-qa/v1" document with totals, a "qa-witness/v1" document with counts and a "block-qa/v1" document with criteria only
    When the qa graph is read
    Then "kg-qa/v1" rolled up from "totals" and "qa-witness/v1" from "counts"
    And "block-qa/v1" has a null roll-up field and no buckets

  @test:pipeline/qa-graph-index.test.ts::classification_reads_the_FILE,_never_the_path::two_families_in_one_directory_are_told_apart
  Scenario: Two families in one directory are told apart
    Given a "page" directory holding a "folio-qa-index/v1" qa-index.json and two "qa-witness/v1" .block.json files
    When the qa graph is read
    Then the families are "qa-witness/v1" with 2 files and "folio-qa-index/v1" with 1 file

  @test:pipeline/qa-graph-index.test.ts::classification_reads_the_FILE,_never_the_path::the_same_content_under_a_misleading_name_lands_in_the_same_family
  Scenario: A misleading file name does not change the family
    Given a file named "looks-like-a-witness.block.json" whose $schema is "kg-qa/v1"
    When the qa graph is read
    Then its family is "kg-qa/v1"

  @test:pipeline/qa-graph-index.test.ts::three_states_—_classified,_unclassified,_unreadable::valid_JSON_with_no_`$schema`_is_UNCLASSIFIED,_not_a_family_and_not_a_failure
  Scenario: Valid JSON with no $schema is unclassified
    Given a "kg-qa/v1" document and a valid JSON document with no $schema
    When the qa graph is read
    Then 1 file is unclassified and 0 are unreadable
    And there is 1 family
    And 2 files are counted

  @test:pipeline/qa-graph-index.test.ts::three_states_—_classified,_unclassified,_unreadable::a_document_that_will_not_parse_is_UNREADABLE,_counted_apart_from_the_above
  Scenario: A document that does not parse is unreadable
    Given a "kg-qa/v1" document and a file "broken.json" that is not JSON
    When the qa graph is read
    Then 1 file is unreadable and 0 are unclassified

  @test:pipeline/qa-graph-index.test.ts::three_states_—_classified,_unclassified,_unreadable::an_empty_`$schema`,_a_JSON_array_and_a_bare_null_are_all_unclassified
  Scenario: An empty $schema, a JSON array and a bare null are unclassified
    Given documents with an empty $schema, a JSON array and a bare null
    When the qa graph is read
    Then 3 files are unclassified and 0 are unreadable
    And there are no families

  @test:pipeline/qa-graph-index.test.ts::three_states_—_classified,_unclassified,_unreadable::a_missing_directory_is_an_empty_projection,_not_a_throw
  Scenario: A missing directory is an empty projection
    When the qa graph is read from a directory that does not exist
    Then the index has the qa graph schema, 0 files, no families, 0 unclassified and 0 unreadable

  @test:pipeline/qa-graph-index.test.ts::the_arithmetic,_which_is_the_only_place_numbers_meet::adds_only_finite_numbers,_and_skips_everything_else_rather_than_coercing
  Scenario: Only finite numbers are added up
    Given an empty tally
    When a roll-up with pass 2, fail "3", skip null, warn NaN and na 0 is accumulated
    Then the tally is pass 2 and na 0

  @test:pipeline/qa-graph-index.test.ts::the_arithmetic,_which_is_the_only_place_numbers_meet::is_additive_across_documents
  Scenario: Accumulation adds across documents
    Given an empty tally
    When pass 2 and then pass 3 with fail 1 are accumulated
    Then the tally is pass 5 and fail 1

  @test:pipeline/qa-graph-index.test.ts::the_arithmetic,_which_is_the_only_place_numbers_meet::ignores_a_roll-up_that_is_not_an_object
  Scenario: A roll-up that is not an object is ignored
    Given an empty tally
    When 7, null and "totals" are accumulated
    Then the tally is empty

  @test:pipeline/qa-graph-index.test.ts::the_arithmetic,_which_is_the_only_place_numbers_meet::`totals`_wins_over_`counts`_when_a_document_somehow_carries_both
  Scenario: The totals field wins over counts
    When the roll-up field of each document shape is read
    Then a document with both totals and counts rolls up from "totals"
    And one with only counts rolls up from "counts"
    And one with neither, or with totals null, has no roll-up field

  @test:pipeline/qa-graph-index.test.ts::the_arithmetic,_which_is_the_only_place_numbers_meet::a_family_whose_first_document_declares_no_roll-up_still_reports_one_if_a_later_one_does
  Scenario: A later document's roll-up field is reported for the family
    Given two "x/v1" documents, the first with no roll-up and the second with totals pass 4
    When the qa graph is read
    Then the family rolled up from "totals"
    And its buckets are pass 4

  @test:pipeline/qa-graph-index.test.ts::ordering_is_stable,_so_a_rerun_is_not_a_diff::largest_first,_ties_broken_by_tag
  Scenario: Families are ordered largest first, ties broken by tag
    Given two "big/v1" documents and one each of "zebra/v1" and "alpha/v1"
    When the qa graph is read
    Then the families are "big/v1", "alpha/v1", "zebra/v1" in that order

  @test:pipeline/qa-graph-index.test.ts::the_tag_is_not_the_one_that_is_already_taken::`folio-qa-graph/v1`_is_distinct_from_the_per-PAGE_`folio-qa-index/v1`
  Scenario: The qa graph schema tag differs from the per-page index tag
    Given the qa graph index schema constant
    Then it is "folio-qa-graph/v1"
    And it is not the tag it must not be confused with

  @test:pipeline/qa-graph-index.test.ts::jsonFilesIn::recurses,_and_takes_only_`.json`
  Scenario: jsonFilesIn recurses and takes only .json files
    Given a directory with "a.json", "deep/b/c.json", "notes.md" and "data.jsonl"
    When its JSON files are listed
    Then they are exactly "a.json" and "deep/b/c.json"

  @test:pipeline/qa-graph-index.test.ts::an_absent_corpus_is_UNKNOWN,_never_a_count_of_what_the_build_wrote_(bean_`tfqf`,_C9)::publishes_no_count,_no_families_and_no_tile_field_when_the_corpus_was_not_there
  Scenario: An absent corpus projects as unknown with no count
    Given a qa graph holding one witness document
    When it is projected with the corpus marked absent
    Then the projection is unknown
    And its keys are exactly "$schema", "availability" and "reason"
    And it has no "files" and no "tile"
    And its reason names "qa-reports"

  @test:pipeline/qa-graph-index.test.ts::an_absent_corpus_is_UNKNOWN,_never_a_count_of_what_the_build_wrote_(bean_`tfqf`,_C9)::a_present_corpus_is_the_census,_unchanged
  Scenario: A present corpus projects as the plain census
    Given a qa graph with one "kg-qa/v1" document
    When it is projected with the corpus marked present
    Then the projection is not unknown
    And it equals reading the qa graph directly

  @test:pipeline/qa-graph-index.test.ts::opts.exclude_in_readQaGraph_and_projectQaGraph_(bean_0kbt)::excludes_queued_orphan_paths_from_the_files_count,_families_and_buckets
  Scenario: Excluded orphan paths are left out of counts, families and buckets
    Given a surviving witness with pass 2, fail 1 and an orphan witness with fail 1
    When the qa graph is read excluding the orphan's path
    Then 1 file is counted, in 1 family of 1 file
    And the family's buckets are pass 2 and fail 1

  @test:pipeline/qa-graph-index.test.ts::opts.exclude_in_readQaGraph_and_projectQaGraph_(bean_0kbt)::passes_opts.exclude_through_projectQaGraph
  Scenario: projectQaGraph passes the exclusion through
    Given a surviving witness with pass 2 and an orphan witness with fail 5
    When the qa graph is projected as present, excluding the orphan's path
    Then the projection is not unknown
    And 1 file is counted with buckets pass 2
