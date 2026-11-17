# A library may declare a directory of another kind from within its
# library.json (cat-harness-tools#281). Each Scenario names its test.
Feature: A directory a library declares from within is not an entry

  @test:scripts/tests/library/library-non-entry-from-within.test.ts::nonEntryDirs::a_directory_the_library_declares_from_within,_of_another_kind,_is_not_an_entry
  Scenario: A directory declared in library.json is not graded as an entry
    Given a library whose library.json declares the directory a-model with the archimate typology
    And an undeclared directory a-document beside it
    When the library's non-entry directories are read
    Then a-model is among them
    And a-document is not
