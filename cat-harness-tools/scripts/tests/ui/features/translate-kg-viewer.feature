# scripts/translate-kg-viewer.ts keeps each locale's kg-viewer .po file in step with the source
# string table and writes its TranslationNode manifest. Each Scenario names the test that executes it.
Feature: Syncing the kg-viewer translation files

  @test:scripts/tests/ui/translate-kg-viewer.test.ts::syncPoContent::adds_a_missing_msgid_to_a_.po_stub_with_empty_msgstr
  Scenario: A msgid missing from the .po is added with an empty msgstr
    Given a French .po holding only "All" with an empty msgstr
    And a source table of "All", "Download this graph as JSON-LD ({doc})" and "Interface language"
    When the .po is synced
    Then it is changed
    And the two missing msgids are reported as added and nothing as removed
    And the .po holds all three msgids, each with an empty msgstr

  @test:scripts/tests/ui/translate-kg-viewer.test.ts::syncPoContent::NEVER_overwrites_an_existing_msgstr_—_filled_translations_survive
  Scenario: An existing msgstr is never overwritten
    Given a French .po translating "All" as "Tous" and "Interface language" as "Langue de l'interface"
    When it is synced with the three-string source table
    Then both translations are kept
    And the new download msgid is present with an empty msgstr

  @test:scripts/tests/ui/translate-kg-viewer.test.ts::syncPoContent::removes_obsolete_strings_no_longer_in_the_source_table_and_reports_them
  Scenario: A string no longer in the source table is removed and reported
    Given a French .po holding "All" and "Old obsolete string"
    When it is synced with the three-string source table
    Then "Old obsolete string" is reported as removed and is gone from the .po
    And the two missing msgids are reported as added

  @test:scripts/tests/ui/translate-kg-viewer.test.ts::syncPoContent::preserves_existing_custom_header_block_byte-for-byte
  Scenario: A custom header block is kept byte for byte
    Given a French .po whose header has two comment lines and an X-Custom-Field
    When it is synced with the three-string source table
    Then the result starts with that exact header

  @test:scripts/tests/ui/translate-kg-viewer.test.ts::syncPoContent::generates_default_header_when_.po_is_empty_or_has_no_header_block
  Scenario: An empty .po gets a default header
    # Gap: only the empty file is tried, not a non-empty one with no header block
    Given an empty Spanish .po
    When it is synced with the three-string source table
    Then it is changed
    And it carries "Language: es" and "Language-Team: Spanish"
    And it says "DO NOT MACHINE-FILL THIS FILE"
    And it holds 3 entries

  @test:scripts/tests/ui/translate-kg-viewer.test.ts::syncPoContent::preserves_existing_entry_flags_like_fuzzy
  Scenario: An entry's fuzzy flag is kept
    Given a French .po whose "All" entry is flagged fuzzy and translated "Tous"
    When it is synced with the three-string source table
    Then the "All" entry is still flagged fuzzy and still reads "Tous"

  @test:scripts/tests/ui/translate-kg-viewer.test.ts::syncPoContent::returns_changed_=_false_when_content_is_already_in_sync
  Scenario: A .po already in sync is reported unchanged
    Given a Spanish .po with the default header and all three source strings with their references and comments
    When it is synced with the same source table
    Then it is not changed
    And nothing is added or removed

  @test:scripts/tests/ui/translate-kg-viewer.test.ts::manifest()_writes_a_TranslationNode_as_JSON_data_(bean_y9r6)::valid_against_TranslationNodeSchema,_with_its_$schema
  Scenario: The manifest is a TranslationNode with its $schema
    When the manifest for "fr" is written
    Then its $schema is the translation node schema
    And its label is "trans:fr/kg-viewer"
    And it is valid against TranslationNodeSchema
