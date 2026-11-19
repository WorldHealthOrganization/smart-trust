# scripts/optimize-library-pngs.ts rewrites library PNGs losslessly and keeps the catalogue
# record of a held file true to the new bytes. Each Scenario names the test that executes it.
Feature: Optimizing library PNGs keeps catalogue fixity true

  @test:test/optimize-library-pngs.test.ts::updateCatalogueFixity::a_rewritten_held_file's_bytes_and_sha256_follow_the_new_content
  Scenario: A rewritten held file's recorded bytes and sha256 follow the new content
    Given library/x-cover.png now holds "new"
    And a catalogue node records it with the bytes and sha256 of "old-bytes"
    When the catalogue fixity is updated for that file, on "2026-10-09"
    Then one update is reported naming the node, the file, the new byte count and the new sha256
    And the node file still ends with "}" and a newline
    And the bitstream's bytes and materialization bytes are the new length
    And its fixity is the new sha256, verified "2026-10-09"

  @test:test/optimize-library-pngs.test.ts::updateCatalogueFixity::a_record_that_already_disagreed_with_the_old_file_is_not_blessed
  Scenario: A record that already disagreed with the old file is left as it was
    Given library/x-cover.png now holds "new"
    And a catalogue node records it as 1 byte with a digest of 64 "f"s, verified "2026-01-01"
    When the catalogue fixity is updated for that file, whose original was "old-bytes"
    Then the record still says 1 byte, the "f" digest and "2026-01-01"

  @test:test/optimize-library-pngs.test.ts::updateCatalogueFixity::files_outside_any_catalogue,_and_nodes_naming_other_files,_are_untouched
  Scenario: Files outside any catalogue and nodes naming other files are untouched
    Given a catalogue node that records library/other.png
    And a rewritten library/x-cover.png and a rewritten file outside the instance
    When the catalogue fixity is updated for both files
    Then no update is reported
    And the node file is byte-for-byte unchanged

  @test:test/optimize-library-pngs.test.ts::optimizeLibraryPngs_end_to_end::an_optimized_held_cover_leaves_its_catalogue_record_matching_the_file_on_disk
  Scenario: An optimized held cover leaves its catalogue record matching the file on disk
    # Skipped: when ImageMagick's convert is not installed
    Given an uncompressed 64x64 PNG cover with a long comment, recorded in the catalogue at its current bytes and sha256
    When the library PNGs are optimized, on "2026-10-09"
    Then one file is optimized and one catalogue update is reported
    And the file is smaller than before
    And the record's bytes and sha256 match the file on disk

  @test:test/optimize-library-pngs.test.ts::optimizeLibraryPngs_end_to_end::a_dry_run_rewrites_nothing,_catalogue_included
  Scenario: A dry run rewrites neither the PNG nor the catalogue
    # Skipped: when ImageMagick's convert is not installed
    Given an uncompressed 64x64 PNG cover recorded in the catalogue
    When the library PNGs are optimized as a dry run
    Then no catalogue update is reported
    And the PNG and the node file are byte-for-byte unchanged
