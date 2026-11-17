# `scripts/check-l1-complete.ts` admits a file an entry was derived from only when a
# sidecar names it as its source and its sha256 matches; anything else stays a stray.
# Each Scenario names the test that executes it.
Feature: An L1 entry may hold its own source bytes

  @test:scripts/tests/l1-held-source.test.ts::heldSources::a_child_named_by_a_sidecar's_source_and_matching_its_sha256_is_held
  Scenario: A child named by a sidecar's source with a matching sha256 is held
    Given an entry holding "doc.pdf" and a "structure.json" whose source names "doc.pdf" with its sha256
    When the held sources are read from "structure.json"
    Then they are exactly "doc.pdf"

  @test:scripts/tests/l1-held-source.test.ts::heldSources::an_edited_copy_is_not_held:_the_hash_decides,_not_the_name
  Scenario: An edited copy is not held
    Given an entry whose "doc.pdf" bytes differ from the sha256 its "structure.json" records
    When the held sources are read from "structure.json"
    Then none are held

  @test:scripts/tests/l1-held-source.test.ts::heldSources::a_multi-file_source_names_each_member_by_path
  Scenario: A multi-file source names each member by path
    Given an entry holding "a.xml" and a "structure.json" whose source files list "a.xml" with its sha256
    When the held sources are read from "structure.json"
    Then they are exactly "a.xml"

  @test:scripts/tests/l1-held-source.test.ts::heldSources::a_path_outside_the_entry's_top_level_is_never_admitted
  Scenario: A source path outside the entry's top level is never admitted
    Given an entry whose "structure.json" source names "../doc.pdf"
    When the held sources are read from "structure.json"
    Then none are held

  @test:scripts/tests/l1-held-source.test.ts::contents::the_review-anchor_sidecars_are_declared_entry_contents
  Scenario: The review-anchor sidecars are declared entry contents
    Then the entry sidecars include "docx-structure.json" and "pdf-line-map.json"

  @test:scripts/tests/l1-held-source.test.ts::contents::a_held_source_passes_contents;_a_loose_file_beside_it_does_not
  Scenario: A held source passes the contents check; a loose file beside it does not
    Given an entry holding "doc.docx", a "docx-structure.json" naming it with its sha256, and a loose "notes.txt"
    When the entry is checked
    Then the contents requirement is unmet with "1 unexpected child(ren): notes.txt"
    And once "notes.txt" is removed the contents requirement is met
    And its detail reports "1 held source(s) matching their recorded sha256: doc.docx"

  @test:scripts/tests/l1-held-source.test.ts::contents::the_library:covers_thumbnail_is_a_declared_entry_content_(#437)
  Scenario: The cover thumbnail is a declared entry content
    Given the entry sidecars include the cover file name
    And an entry holding a cover file
    When the entry is checked
    Then the contents requirement's detail does not name the cover file
