# scripts/archive-contents.py lists an archive's entries as contents.jsonld, ingest routing sends
# archives to that rung by sniffed content, and check-l1-complete gates the listing.
# Each Scenario names the test that executes it.
Feature: Archive contents listing and its gate

  @test:scripts/tests/archive-contents.test.ts::one_schema,_whatever_the_container::zip_and_tar_produce_the_same_shape_and_the_same_digests
  Scenario: Zip and tar packings of the same tree list identically
    Given a tree with a text file and a nested PDF, packed as a zip and as a tar.gz
    When archive-contents.py lists each
    Then both listings pass the archive-contents schema
    And the zip's format is "zip" and the tar's is "tar"
    And the sorted file path and sha256 pairs of the two listings are equal

  @test:scripts/tests/archive-contents.test.ts::routing_happens_on_CONTENT,_with_no_PDF_backend_needed::a_gzip/tar_takes_it_too
  Scenario: A gzipped tar takes the archive rung
    Given the tar.gz fixture
    When an ingest plan is made for it
    Then the rung is "archive"
    And the reason mentions "application/gzip"

  @test:scripts/tests/archive-contents.test.ts::routing_happens_on_CONTENT,_with_no_PDF_backend_needed::a_file_NAMED_.pdf_that_is_really_a_zip_still_routes_as_an_archive
  Scenario: A file named .pdf that is really a zip routes as an archive
    Given a copy of the zip fixture named "actually-a-zip.pdf"
    When an ingest plan is made for it
    Then the rung is "archive"

  @test:scripts/tests/archive-contents.test.ts::routing_happens_on_CONTENT,_with_no_PDF_backend_needed::a_real_PDF_does_NOT_take_the_archive_rung
  Scenario: A real PDF does not take the archive rung
    Given a minimal PDF fixture file
    When its mimetype is sniffed
    Then it is "application/pdf"
    And an ingest plan for it is not on the "archive" rung

  @test:scripts/tests/archive-contents.test.ts::routing_happens_on_CONTENT,_with_no_PDF_backend_needed::the_mimetype_can_be_supplied,_so_the_decision_is_testable_in_isolation
  Scenario: A supplied mimetype decides the rung without reading a file
    When a plan is made for "x" with mimetype "application/zip"
    Then the rung is "archive"
    And with a usable outline and a null or "application/pdf" mimetype the rung is "pdf-structure"

  @test:scripts/tests/archive-contents.test.ts::routing_happens_on_CONTENT,_with_no_PDF_backend_needed::isArchiveMimetype_refuses_everything_else
  Scenario: isArchiveMimetype accepts only archive mimetypes
    When isArchiveMimetype is asked about "application/pdf", "text/html", null, undefined and the empty string
    Then each answer is false
    And for "application/zip", "application/gzip" and "application/x-tar" each answer is true

  @test:scripts/tests/archive-contents.test.ts::the_gate_fires_on_an_archive_with_no_listing::an_archive_entry_with_no_contents.jsonld_is_UNMET
  Scenario: An archive entry with no contents.jsonld is unmet
    Given a library entry whose source sniffed as "application/zip" and has no contents.jsonld
    When the entry is checked
    Then the archive-contents requirement is "unmet" with a detail mentioning "no contents.jsonld"

  @test:scripts/tests/archive-contents.test.ts::the_gate_fires_on_an_archive_with_no_listing::a_valid_listing_is_MET_and_reports_its_counts
  Scenario: A valid listing is met and reports its counts
    Given a zip entry whose contents.jsonld is a real listing of the zip fixture
    When the entry is checked
    Then the archive-contents requirement is "met" with a detail mentioning "file(s)"

  @test:scripts/tests/archive-contents.test.ts::the_gate_fires_on_an_archive_with_no_listing::a_listing_that_is_not_the_declared_schema_is_UNMET
  Scenario: A listing of another schema is unmet
    Given a zip entry whose contents.jsonld declares "something-else/v1"
    When the entry is checked
    Then the archive-contents requirement is "unmet" with a detail naming the archive-contents schema id

  @test:scripts/tests/archive-contents.test.ts::the_gate_fires_on_an_archive_with_no_listing::an_unparseable_listing_is_unmet_rather_than_an_exception
  Scenario: An unparseable listing is unmet rather than an exception
    Given a zip entry whose contents.jsonld is not valid JSON
    When the entry is checked
    Then the archive-contents requirement is "unmet"

  @test:scripts/tests/archive-contents.test.ts::the_gate_fires_on_an_archive_with_no_listing::a_PDF_entry_is_MET_and_SAYS_SO_—_a_determined_zero,_not_silence
  Scenario: A PDF entry is met and says it is not an archive
    Given a library entry whose source sniffed as "application/pdf"
    When the entry is checked
    Then the archive-contents requirement is "met"
    And its detail is "not an archive (application/pdf)"

  @test:scripts/tests/archive-contents.test.ts::the_gate_fires_on_an_archive_with_no_listing::an_absent_mimetype_says_so,_in_BOTH_its_spellings
  Scenario: An absent mimetype is reported as such, whether empty or null
    Given library entries whose sniffed mimetype is "" and null
    When each is checked
    Then each archive-contents detail mentions "no sniffed mimetype"

  @test:scripts/tests/archive-contents.test.ts::the_real_corpus::four_PDFs,_zero_archives,_and_the_gate_says_so_per_entry
  Scenario: Every entry of the real corpus is met as not an archive
    # Gap: the count of four PDFs is not asserted
    Given the real library declared under the harness root
    When every entry is checked
    Then the library is declared and has at least one entry
    And each entry's archive-contents requirement is "met" with a detail mentioning "not an archive"

  @test:scripts/tests/archive-contents.test.ts::the_archive_record_is_JSON-LD_a_processor_keeps_whole::the_arm_emits_the_published_context,_and_every_key_is_a_declared_term
  Scenario: The archive listing carries the published context and only declared keys
    Given the zip fixture listed into a library directory
    When its contents.jsonld is read and the directory's keys are checked
    Then its "@context" is the published content context URL
    And one document is checked with no undeclared keys

  @test:scripts/tests/archive-contents.test.ts::one_schema,_whatever_the_container::the_mimetype_is_sniffed_from_the_ENTRY's_own_bytes,_not_its_name
  Scenario: Each entry's mimetype is sniffed from its own bytes
    Given the zip fixture with "a.txt" and a nested "b.pdf"
    When archive-contents.py lists it
    Then the "b.pdf" entry is sniffed as "application/pdf" from "magic-bytes"
    And the "a.txt" entry has a null sniffed mimetype with source "unrecognised"

  @test:scripts/tests/archive-contents.test.ts::one_schema,_whatever_the_container::a_directory_is_listed_with_no_size_and_no_digest
  Scenario: Directory entries carry no size and no digest
    Given the zip fixture
    When archive-contents.py lists it
    Then at least one entry is a directory
    And no directory entry has bytes or a sha256

  @test:scripts/tests/archive-contents.test.ts::one_schema,_whatever_the_container::the_counts_agree_with_the_entries_—_the_schema_refuses_it_otherwise
  Scenario: The entry counts agree with the entries and the schema enforces it
    Given the zip fixture's listing
    Then n_entries equals the number of entries
    And n_files equals the number of file entries
    And the same listing with n_entries raised by one fails the archive-contents schema

  @test:scripts/tests/archive-contents.test.ts::one_schema,_whatever_the_container::a_non-archive_is_REFUSED,_never_listed_as_empty
  Scenario: A non-archive is refused, not listed as empty
    Given a text file named "plain.zip" that is not a zip
    When archive-contents.py is run on it
    Then it exits non-zero
    And stderr says "not an archive"

  @test:scripts/tests/archive-contents.test.ts::routing_happens_on_CONTENT,_with_no_PDF_backend_needed::a_zip_takes_the_archive_rung
  Scenario: A zip takes the archive rung
    Given the zip fixture
    When an ingest plan is made for it
    Then the rung is "archive"
    And the first step runs a path ending in "/archive-contents.py"
    And the reason mentions "application/zip"
