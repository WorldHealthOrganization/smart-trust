# The strict site-index schemas in schemas/ui/site-indexes.ts accept the fields
# cat-harness-tools' generators write: translation status, schema graph and library index.
# Each Scenario names the test that executes it.
Feature: Site index schemas accept the generators' fields

  @test:schemas/site-indexes-generator-fields.test.ts::folio-translation-status/v1_carries_the_drawer's_fields::per-catalogue_rows_and_officiality_parse
  Scenario: Translation status accepts per-catalogue file rows and officiality
    Given a folio-translation-status/v1 index whose "fr" locale has a "site/x.po" file row and an "unofficial" officiality
    When it is parsed
    Then there are no issues

  @test:schemas/site-indexes-generator-fields.test.ts::folio-translation-status/v1_carries_the_drawer's_fields::the_status_page_the_drawer_links_parses
  Scenario: Translation status accepts the status page the drawer links
    Given a translation status index with page "en/cat-harness/translation-status/index.md"
    When it is parsed
    Then there are no issues

  @test:schemas/site-indexes-generator-fields.test.ts::folio-translation-status/v1_carries_the_drawer's_fields::an_index_written_before_the_fields_existed_still_parses
  Scenario: A translation status index without the new fields still parses
    Given a translation status index with no files, officiality or page
    When it is parsed
    Then it succeeds

  @test:schemas/site-indexes-generator-fields.test.ts::folio-translation-status/v1_carries_the_drawer's_fields::an_officiality_state_outside_the_four_is_refused
  Scenario: An officiality state outside the allowed set is refused
    # Gap: the four allowed states are not enumerated; only "signed" is tried
    Given a translation status index whose officiality state is "signed"
    When it is parsed
    Then it fails

  @test:schemas/site-indexes-generator-fields.test.ts::folio-schema-graph/v1_carries_the_source-descriptor_rows::a_row_with_every_optional_field_parses
  Scenario: A schema graph source row with every optional field parses
    Given a folio-schema-graph/v1 index with a source row "iris" carrying title, identifiers, enumeration and character
    When it is parsed
    Then there are no issues

  @test:schemas/site-indexes-generator-fields.test.ts::folio-schema-graph/v1_carries_the_source-descriptor_rows::an_unknown_key_on_a_row_is_still_refused
  Scenario: An unknown key on a schema graph source row is refused
    Given a schema graph index with a source row carrying an extra key
    When it is parsed
    Then it fails

  @test:schemas/site-indexes-generator-fields.test.ts::folio-library-index/v1_entries_carry_catalogue_and_upstream_links_(#1752,_#1765)::an_entry_with_catalogue_and_upstream_metadata_parses
  Scenario: A library index entry with catalogue and upstream metadata parses
    Given a library index entry with a catalogue record, handle, xml and node, and one upstream link
    When it is parsed
    Then there are no issues

  @test:schemas/site-indexes-generator-fields.test.ts::folio-library-index/v1_entries_carry_catalogue_and_upstream_links_(#1752,_#1765)::a_catalogued_entry_whose_id_has_capitals_has_a_view_that_parses
  Scenario: A library entry view with capitals in the id parses
    Given a library index entry with view "/library/who-iris/WHO-2019-nCoV-eng/"
    When it is parsed
    Then there are no issues

  @test:schemas/site-indexes-generator-fields.test.ts::folio-library-index/v1_entries_carry_catalogue_and_upstream_links_(#1752,_#1765)::a_view_without_its_leading_or_trailing_slash_is_refused
  Scenario: A library entry view missing its leading or trailing slash is refused
    Given a library index entry with view "library/who-iris/x/"
    And one with view "/library/who-iris/x"
    When each is parsed
    Then both fail

  @test:schemas/site-indexes-generator-fields.test.ts::folio-library-index/v1_entries_carry_catalogue_and_upstream_links_(#1752,_#1765)::an_unknown_key_inside_catalogue_is_refused
  Scenario: An unknown key inside a library entry's catalogue is refused
    Given a library index entry whose catalogue carries an extra key
    When it is parsed
    Then it fails
