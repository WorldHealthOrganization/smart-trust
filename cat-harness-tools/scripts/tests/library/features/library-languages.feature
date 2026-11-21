# The language versions and summary of a library entry, read from the catalogue by
# scripts/lib/library-languages.ts, and the upstream PDF of a not-held entry from
# scripts/lib/library-upstream-pdf.ts. Each Scenario names the test that executes it.
Feature: Library entry language versions

  @test:scripts/tests/library/library-languages.test.ts::library_entry_language_versions::reads_a_file's_language_from_its_IRIS_suffix,_and_a_slug_from_provenance.local
  Scenario: A file's language comes from its IRIS suffix, and a slug from provenance.local
    Then "WHO_RHR_06.11_ara.pdf" is "ar", "A71_R7-ch.pdf" is "zh", and "report.pdf" has no language
    And the slug of "library/10665-1-ara/structure.json#source" is "10665-1-ara"
    And "../etc/passwd" yields no slug

  @test:scripts/tests/library/library-languages.test.ts::library_entry_language_versions::joins_one_item's_editions_and_linked_items;_English_is_the_source
  Scenario: One item's editions and linked items are joined, with English as the source
    Given a catalogue where item 10665-1 has English and Arabic PDFs and links 10665/2 as a language version, and item 10665-2 is French
    When the language versions of entries 10665-1, 10665-1-ara and 10665-2 are read
    Then 10665-1-ara is "ar", and its versions are en marked as source, then fr, then ar
    And the abstract of 10665-2 is "La stratégie." and of 10665-1 is "The strategy."

  @test:scripts/tests/library/library-languages.test.ts::library_entry_language_versions::a_version_that_is_not_an_entry_of_the_library_is_not_linked
  Scenario: A version that is not an entry of the library is not linked
    Given the same catalogue, with only 10665-1 an entry of the library
    When its language versions are read
    Then it has no versions

  @test:scripts/tests/library/library-languages.test.ts::library_entry_language_versions::the_listing_gets_each_entry's_language_and_its_held_editions'_titles,_and_none_it_does_not_hold
  Scenario: The listing gets each entry's language and its held editions' titles
    Given a catalogue where English item 10665-1 links French item 10665-2 as a language version, both entries of the library
    When the listing titles are read
    Then 10665-2 is "fr" with the English title "The strategy", and 10665-1 is "en" with the French title "La stratégie"
    And with only 10665-2 in the library it is "fr" with no other titles

  @test:scripts/tests/library/library-languages.test.ts::library_entry_language_versions::the_HTML_escapes_and_names_each_version;_no_summary_without_an_abstract
  Scenario: The versions HTML links and names each version; no summary without an abstract
    Given an English source version 10665-1 and a French version 10665-2
    When the versions HTML of 10665-1 is written
    Then it links "../10665-2/", says "WHO official translation", and marks the current page with aria-current
    And the summary of no abstract is empty
    And the summary of "<b>x</b>" is escaped

  @test:scripts/tests/library/library-languages.test.ts::library_entry_language_versions::a_not-held_entry_links_the_file_it_was_derived_from,_at_its_source
  Scenario: A not-held entry links the file it was derived from, at its source
    Given an item with an Arabic PDF that has an https upstream and a sha256, and an English PDF whose upstream is a javascript: link
    When the upstream PDF of each slug is read
    Then "x-ara" gives "x-ara.pdf" at its download link with its sha256
    And "x" gives nothing, and no item file gives nothing
