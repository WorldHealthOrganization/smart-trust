# retire-library-pdf.py: a processed PDF leaves the repository, and the entry
# keeps everything derived from it plus a record of where the bytes are.
Feature: Retiring a processed library PDF

  @test:scripts/tests/library/retire-library-pdf.test.ts::retire-library-pdf::dry_run_by_default:_nothing_is_written_or_removed
  Scenario: A dry run writes and removes nothing
    Given a processed arXiv library entry holding its PDF
    When the script runs without --apply
    Then the entry's result is "retire"
    And the PDF is still there and no source.materialization.json is written

  @test:scripts/tests/library/retire-library-pdf.test.ts::retire-library-pdf::--apply_removes_the_PDF,_keeps_the_derived_files,_and_records_where_the_bytes_are
  Scenario: --apply removes the PDF and records where the bytes are
    Given a processed arXiv entry committed in git, with the same bytes kept on the fsh-guts branch
    When the script runs with --apply
    Then it exits 0 with result "retired"
    And the PDF is gone while structure.json and the sections remain
    And the materialization record is "referenced", names the file, its size and its sha256 fixity
    And its upstream is the arXiv PDF URL, with a note that the upstream bytes are not promised to match
    And it names the fsh-guts copy by a URL pinned to a 40-hex commit, with ref cat/cat-harness/fsh-guts

  @test:scripts/tests/library/retire-library-pdf.test.ts::retire-library-pdf::a_second_run_reports_already-retired_and_touches_nothing
  Scenario: A second run reports already-retired and changes nothing
    Given an entry already retired with --apply
    When the script runs with --apply again
    Then the result is "already-retired"
    And the materialization record is unchanged

  @test:scripts/tests/library/retire-library-pdf.test.ts::retire-library-pdf::a_sha256_mismatch_is_REFUSED_and_exits_non-zero:_the_record_would_name_the_wrong_bytes
  Scenario: A sha256 mismatch is refused
    Given an entry whose structure.json records a sha256 the PDF does not have
    When the script runs with --apply
    Then it exits 1 with result "refused"
    And the PDF is still there

  @test:scripts/tests/library/retire-library-pdf.test.ts::retire-library-pdf::an_unprocessed_entry_is_skipped:_its_PDF_has_not_been_read_yet
  Scenario: An unprocessed entry is skipped
    Given an entry with no sections
    When the script runs with --apply
    Then the result is "skipped" with a reason saying "not processed"
    And the PDF is still there

  @test:scripts/tests/library/retire-library-pdf.test.ts::retire-library-pdf::no_arXiv_id:_skipped_unless_a_DOI_or_history-only_is_allowed
  Scenario: An entry with no arXiv id needs a DOI or history-only allowed
    Given an entry with no arXiv id and a DOI
    Then a plain run skips it
    And with --allow-doi its result is "retire" with the doi.org URL as upstream
    And given an entry in git with neither an arXiv id nor a DOI, --allow-doi skips it
    And --allow-history --apply retires it with no upstream and the fsh-guts path as its retired copy

  @test:scripts/tests/library/retire-library-pdf.test.ts::retire-library-pdf::history-only_needs_an_fsh-guts_copy_of_the_same_bytes
  Scenario: History-only retirement needs an fsh-guts copy of the same bytes
    Given an entry with no arXiv id that is not in git, or has no fsh-guts copy, or one of other bytes
    When the script runs with --allow-history --apply
    Then each result is "skipped" and the PDF is still there

  @test:scripts/tests/library/retire-library-pdf.test.ts::retire-library-pdf::a_copy_holding_other_bytes_is_never_named,_even_when_arXiv_is_the_upstream
  Scenario: An fsh-guts copy of other bytes is never named
    Given an arXiv entry in git whose fsh-guts copy holds other bytes
    When the script runs with --apply
    Then the record's provenance has no retiredCopy

  @test:scripts/tests/library/retire-library-pdf.test.ts::the_manifest_carries_the_record::source_materialization_appears_in_meta_when_given,_and_is_absent_otherwise
  Scenario: The manifest carries the materialization record when given
    Given a document structure and a materialization record
    When the document nodes are built with the record
    Then the manifest's meta.source_materialization equals the record
    And built without it, meta has no source_materialization
