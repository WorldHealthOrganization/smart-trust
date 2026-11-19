# Specifies schemas/ui/pdf-structure.ts: the pdf-structure/v1 schema for the
# structure.json that pdf-structure.py writes for a PDF in a library (issue
# #1112), and the drifts it exists to reject.
Feature: A PDF's structure.json conforms to pdf-structure/v1

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::there_are_committed_structure.json_files_to_check
  Scenario: The glob finds committed structure.json files
    Given the structure.json files matched by "*/library/*/structure.json" three directories above this module, outside node_modules and ingest-staging
    When they are counted
    Then there is at least one

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::every_committed_PDF_structure.json_conforms
  Scenario: Every committed PDF structure.json conforms
    Given the committed structure.json files whose tag is neither notebook-structure/v1 nor text-structure/v1
    When each is parsed with the pdf-structure schema
    Then there are more than 10 of them
    And none is refused

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::the_minimal_artefact_conforms
  Scenario: The minimal artefact conforms
    Given a structure with one section, no TOC and a magic-bytes sniffed source
    When it is parsed
    Then it parses

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::a_second_spelling_of_a_section_field_is_rejected_(the_section_id_crash)
  Scenario: A section carrying section_id beside id is refused
    Given the minimal structure whose section also carries section_id
    When it is parsed
    Then it is refused

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::the_diagnostics_pdf-structure.py_writes_are_accepted:_furniture_lines_stripped,_outline_reordered
  Scenario: The diagnostics pdf-structure.py writes are accepted
    Given the minimal structure with diagnostics including furniture_lines_stripped 12, outline_reordered true and grade_marks_written 14
    When it is parsed
    Then it parses with no issues
    And the same diagnostics with outline_reordered false are refused

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::an_unknown_top-level_key_is_rejected
  Scenario: An unknown top-level key is refused
    Given the minimal structure with an extra key sections_text
    When it is parsed
    Then it is refused

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::a_section_ending_before_it_starts_is_rejected
  Scenario: A section ending before it starts is refused
    Given the minimal structure whose section starts on page 3 and ends on page 2
    When it is parsed
    Then it is refused

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::an_unknown_toc_source_is_rejected;_the_four_states_and_outline-unusable_are_accepted
  Scenario: The TOC source is one of five values
    Given the minimal structure
    When its toc_source is "guessed"
    Then it is refused
    And with each of "outline", "inferred", "undetermined", "none", "outline-unusable" it parses

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::the_text_origin_has_one_field_and_one_vocabulary_(issue_#1121)
  Scenario: The text origin is source.text_source, embedded or ocr
    Given the minimal structure
    When source.text_source is "embedded" or "ocr"
    Then it parses
    And source.text_source "text-layer" is refused
    And a top-level text_source "ocr" is refused

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::which_software_made_the_text_is_a_run-context_reference_by_sha256,_nothing_else
  Scenario: The text software is a run-context reference by sha256
    Given the minimal structure with source.text_source "ocr"
    When source.runContext holds only a 64-hex sha256
    Then it parses
    And a runContext that also names an engine is refused
    And a runContext whose sha256 is "not-a-digest" is refused
    And a source.ocr_engine field is refused

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::an_unrecognised_mimetype_is_null_with_its_reason,_never_guessed
  Scenario: An unrecognised mimetype is null with a required reason, and no guess is a reason
    Given the minimal structure whose mimetype_sniffed is null and mimetype_source is "unrecognised"
    When it is parsed
    Then it parses
    And the same structure with no mimetype_source is refused
    And the same structure with mimetype_source "extension", "file-extension" or "guessed" is refused
    And a null mimetype parses with "unreadable" and is refused with "magic-bytes" or "zip-package"
    And a sniffed mimetype parses with "magic-bytes" or "zip-package" and is refused with "unrecognised" or "unreadable"

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::a_duplicate_copy_names_its_preferred_entry;_the_preferred_entry_lists_its_copies
  Scenario: Duplicates name their preferred entry, and the preferred entry lists its copies
    Given the minimal structure
    When it carries duplicate_of "arxiv-1206.6004v2" with a duplicate_note
    Then it parses
    And duplicate_copies ["a", "b"] parses
    And an empty duplicate_of is refused
    And duplicate_copies given as a string is refused

  @test:schemas/ui/pdf-structure.test.ts::pdf-structure/v1::a_bound_volume,_hand-supplied_headings_and_a_hand_OCR_say_so_in_their_own_fields
  Scenario: A bound volume, hand-supplied headings and a hand OCR have their own fields
    Given the minimal structure
    When it carries container true with container_children and a container_note
    Then it parses
    And a toc_note parses
    And a text_extraction with route "ocr", an engine, psm, an intermediate sha256 and a quality parses
    And a text_extraction with route "guess" is refused
    And a text_extraction with an extra field is refused
    And container_children holding an empty string is refused
