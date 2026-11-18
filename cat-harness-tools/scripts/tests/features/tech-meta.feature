# Technical file metadata (bean nso8), from the Python module both ingest
# rungs share, driven through python3; and --refresh-meta, which adds it to
# an entry's structure.json without reformatting the file. Each Scenario
# names the test that executes it.
Feature: Technical file metadata

  @test:scripts/tests/tech-meta.test.ts::the_mimetype_is_sniffed,_never_claimed::magic_bytes_decide,_and_the_source_says_so
  Scenario: Magic bytes decide the mimetype, and the source says so
    Given a file x.pdf beginning "%PDF-1.7"
    When its technical metadata is read
    Then the sniffed mimetype is "application/pdf" and its source "magic-bytes"

  @test:scripts/tests/tech-meta.test.ts::the_mimetype_is_sniffed,_never_claimed::a_.pdf_that_is_really_HTML_is_reported_as_HTML_—_the_whole_point
  Scenario: A .pdf that is really HTML is reported as HTML
    Given a file report.pdf beginning "<!DOCTYPE html>"
    When its technical metadata is read
    Then the sniffed mimetype is "text/html"

  @test:scripts/tests/tech-meta.test.ts::the_mimetype_is_sniffed,_never_claimed::recordings_are_sniffed_by_their_container_(bean_1r0p)
  Scenario: Recordings are sniffed by their container
    Then ISO base media files branded isom, "M4A " and "qt  " sniff as video/mp4, audio/mp4 and video/quicktime
    And RIFF WAVE, ID3, OggS and fLaC files sniff as audio/wav, audio/mpeg, audio/ogg and audio/flac
    And a RIFF AVI file sniffs as null

  @test:scripts/tests/tech-meta.test.ts::the_mimetype_is_sniffed,_never_claimed::unrecognised_bytes_are_NULL,_never_guessed_from_the_extension
  Scenario: Unrecognised bytes are null, never guessed from the extension
    Given a file thing.pdf holding plain words and no signature
    When its technical metadata is read
    Then the sniffed mimetype is null and its source "unrecognised"

  @test:scripts/tests/tech-meta.test.ts::the_mimetype_is_sniffed,_never_claimed::`mimetype_source`_distinguishes_looked-at-and-unknown_from_never-looked
  Scenario: The mimetype source tells an unknown sniff from a recognised one
    Then a file of "zzz" has the source "unrecognised"
    And a file with the PNG signature has the source "magic-bytes"

  @test:scripts/tests/tech-meta.test.ts::the_mechanical_facts::every_field_nso8_asks_for_is_present
  Scenario: Every field nso8 asks for is present
    When the technical metadata of a PDF is read
    Then its keys are exactly bytes, file, mimetype_sniffed, mimetype_source, mtime and sha256

  @test:scripts/tests/tech-meta.test.ts::the_mechanical_facts::sha256_is_the_FULL_digest,_not_a_truncation
  Scenario: sha256 is the full digest
    When the technical metadata of a PDF is read
    Then its sha256 is 64 lowercase hex digits

  @test:scripts/tests/tech-meta.test.ts::the_mechanical_facts::mtime_is_the_SOURCE's,_in_UTC,_to_the_second
  Scenario: mtime is in UTC to the second
    # Gap: only the format is checked; that the time is the source file's own is not
    When the technical metadata of a PDF is read
    Then its mtime has the form YYYY-MM-DDTHH:MM:SSZ

  @test:scripts/tests/tech-meta.test.ts::the_mechanical_facts::identical_bytes_under_different_names_give_the_same_digest
  Scenario: Identical bytes under different names give the same digest
    Given one.pdf and two.pdf with the same bytes
    When their technical metadata is read
    Then their sha256 digests are equal and their file fields differ

  @test:scripts/tests/tech-meta.test.ts::--refresh-meta_does_not_reformat_the_file_it_refreshes::an_indent-%d_file_keeps_its_indent
  Scenario Outline: A refreshed structure.json keeps its indent
    Given a library entry whose structure.json is written at indent <indent>
    When its metadata is refreshed from the source PDF
    Then the first indented line is still indented by <indent>

    Examples:
      | indent |
      | 1      |
      | 2      |

  @test:scripts/tests/tech-meta.test.ts::--refresh-meta_does_not_reformat_the_file_it_refreshes::only_the_`source`_block_is_added_—_every_other_line_is_byte-identical
  Scenario: Refreshing adds only the source block
    # Gap: the other fields are compared after JSON re-serialisation, not line by line as bytes
    Given a library entry whose structure.json is written at indent 1
    When its metadata is refreshed from the source PDF
    Then without its source key it equals the original
    And its source's mimetype source is "magic-bytes", and the file still ends with a newline
