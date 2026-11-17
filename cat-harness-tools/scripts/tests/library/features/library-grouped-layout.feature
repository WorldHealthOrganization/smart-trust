# Library entries flat or filed in a concern group (bean 6fez, placement
# ruling 3). A group is told from an entry by library/library.json, never by
# its name. Each Scenario names the test that executes it.
Feature: Library entries flat or filed in a concern group

  @test:scripts/tests/library/library-grouped-layout.test.ts::libraryEntryDirs::a_flat_library_lists_exactly_its_subdirectories,_sorted_as_readdirSync().sort()_sorts_them
  Scenario: A flat library lists its subdirectories in code-point order
    Given a library holding entries b-doc, a-doc and C-doc and no groups
    When its entry directories are listed
    Then the slugs are C-doc, a-doc, b-doc
    And every entry has no group, a rel equal to its slug, and its directory under the library

  @test:scripts/tests/library/library-grouped-layout.test.ts::libraryEntryDirs::a_mixed_library_lists_unfiled_and_filed_entries,_and_never_a_group_as_an_entry
  Scenario: A mixed library lists filed and unfiled entries but no group
    Given a library with unfiled-doc, and declared groups kg (deerwester-lsa, landauer-lsa) and sdlc (beans-readme)
    When its entry directories are listed
    Then the rels are sdlc/beans-readme, kg/deerwester-lsa, kg/landauer-lsa, unfiled-doc
    And deerwester-lsa is listed with its directory, rel kg/deerwester-lsa and group kg
    And neither kg nor sdlc is listed as an entry

  @test:scripts/tests/library/library-grouped-layout.test.ts::libraryEntryDirs::an_UNDECLARED_directory_is_an_entry_even_when_its_name_is_a_group_code_—_location_is_declared,_not_guessed
  Scenario: An undeclared directory named like a group code is an entry
    Given a library with an unfiled directory ui and a declared group kg holding x
    When its entry directories are listed
    Then the rels are ui and kg/x
    And ui has no group

  @test:scripts/tests/library/library-grouped-layout.test.ts::libraryEntryDirs::an_absent_library_lists_nothing
  Scenario: An absent library lists nothing
    Given a library path that does not exist
    When its entry directories are listed
    Then the list is empty

  @test:scripts/tests/library/library-grouped-layout.test.ts::libraryEntryDir_and_libraryOfEntry::a_slug_resolves_wherever_it_is_filed,_and_an_absent_one_to_undefined
  Scenario: A slug resolves wherever it is filed
    Given a library with unfiled-doc and kg/deerwester-lsa
    Then slug unfiled-doc resolves to library/unfiled-doc
    And slug deerwester-lsa resolves to library/kg/deerwester-lsa
    And slugs missing, kg and kg/deerwester-lsa resolve to nothing

  @test:scripts/tests/library/library-grouped-layout.test.ts::libraryEntryDir_and_libraryOfEntry::the_library_of_an_entry_is_its_parent,_or_its_grandparent_past_a_group
  Scenario: The library of an entry is found past a group
    Given a library with unfiled-doc and kg/deerwester-lsa
    Then the library of each entry is the library directory

  @test:scripts/tests/library/library-grouped-layout.test.ts::readers_over_a_grouped_library::`library/<bib-slug>`_evidence_resolves_to_a_filed_entry_without_rewriting_the_reference
  Scenario: library/<slug> evidence resolves to a filed entry
    Given an instance whose library holds unfiled-doc and kg/deerwester-lsa
    Then evidence library/deerwester-lsa resolves to library/kg/deerwester-lsa
    And library/deerwester-lsa/sections resolves to its sections directory
    And library/unfiled-doc resolves to library/unfiled-doc
    And library/kg resolves to nothing

  @test:scripts/tests/library/library-grouped-layout.test.ts::readers_over_a_grouped_library::LSI_indexes_the_sections_of_filed_and_unfiled_entries_alike,_and_nothing_of_a_group_itself
  Scenario: LSI indexes filed and unfiled entries alike
    Given a library with unfiled-doc and kg/deerwester-lsa, each holding one section
    When its LSI units are listed
    Then they are exactly the section of each entry
    And naming deerwester-lsa selects one unit

  @test:scripts/tests/library/library-grouped-layout.test.ts::writers_and_lists_over_a_grouped_library::a_filed_entry_is_withheld_by_the_library_root's_list,_not_the_group_directory's
  Scenario: A filed entry is withheld by the library root's list
    Given a library root withheld.json listing deerwester-lsa with reason "licence not cleared"
    Then the filed entry kg/deerwester-lsa is withheld for "licence not cleared"
    And unfiled-doc is not withheld

  @test:scripts/tests/library/library-grouped-layout.test.ts::writers_and_lists_over_a_grouped_library::re-ingesting_a_filed_entry_writes_it_where_it_is_filed,_and_a_new_one_lands_unfiled
  Scenario: Re-ingesting writes a filed entry in place and a new one unfiled
    Given a library with the filed entry kg/deerwester-lsa
    When a text source is ingested as deerwester-lsa
    Then its structure.json is written under kg/deerwester-lsa and no unfiled deerwester-lsa is made
    And when it is ingested as new-upload, structure.json lands under library/new-upload
