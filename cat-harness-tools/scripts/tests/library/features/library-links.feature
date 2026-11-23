# library-links: where a library reference links (bean qgjh). These read the
# built library projection, and are skipped where it is not built.
Feature: Where a library reference links

  @test:scripts/tests/library/library-links.test.ts::a_library_reference_resolves_only_where_its_target_exists::gives_an_arXiv_item_its_arXiv_record,_and_invents_none_for_the_rest
  Scenario: An arXiv item links to its arXiv record
    # Gap: "invents none for the rest" is checked only for the first entry named <13 digits>-eng, and only when one exists; other non-arXiv entries are not checked.
    Given the built library projection
    And an arxiv- entry whose manifest records an arXiv id
    When the entry's links are resolved
    Then its source is an https://arxiv.org/abs/<id>v<n> URL
    And if an entry named <13 digits>-eng exists, its source is undefined

  @test:scripts/tests/library/library-links.test.ts::a_library_reference_resolves_only_where_its_target_exists::does_not_link_a_reference_it_cannot_place
  Scenario: A reference that cannot be placed is not linked
    Given the built library projection
    When the links of an unknown item, or of a known item in an unknown instance, are resolved
    Then neither has links

  @test:scripts/tests/library/library-links.test.ts::the_library_projection_carries_what_a_reader_opens_(qgjh)::gives_every_entry_with_a_README_its_page_link
  Scenario: Every entry with a README carries its page link
    Given the built library projection
    When an entry's directory holds a README.md
    Then the entry's readme link ends with its path below the instance directory and /README.md

  @test:scripts/tests/library/library-links.test.ts::the_library_projection_carries_what_a_reader_opens_(qgjh)::carries_the_arXiv_id_its_manifest_records,_not_the_empty_string_the_flattened_record_gave
  Scenario: The projection carries the arXiv id the manifest records
    Given the built library projection
    And at least one entry whose manifest records an arXiv id
    Then each such entry's arxiv field equals the id its manifest records
