# A library entry's DECLARED sub-graphs are found and published, and only
# those (bean 8pzh item 1). Each Scenario names the test that executes it.
Feature: A library entry's declared sub-graphs

  @test:scripts/tests/library/library-entry-graphs.test.ts::entryGraphFiles::every_file_of_a_declared_within-library_directory,_by_its_path_in_the_entry;_JSON-LD_is_marked
  Scenario: Every file of a declared within-library directory is listed
    Given an entry e1 whose out/ directory is declared with a published within-library kind
    And out/ holds a JSON file, two JSON-LD files (one in a subdirectory) and a Markdown file
    When the entry's graph files are listed
    Then each file is listed by its path inside the entry, sorted, with that kind
    And only the files carrying an @context are marked JSON-LD

  @test:scripts/tests/library/library-entry-graphs.test.ts::entryGraphFiles::an_UNDECLARED_directory_in_the_entry_is_not_published,_whatever_it_holds
  Scenario: An undeclared directory in the entry is not published
    Given an entry e1 with a declared out/ directory and an undeclared directory holding JSON-LD
    When the entry's graph files are listed
    Then no listed file lies under the undeclared directory

  @test:scripts/tests/library/library-entry-graphs.test.ts::entryGraphFiles::nothing_without_a_declaration_—_the_files_on_disk_are_not_enough
  Scenario: Files on disk without a declaration publish nothing
    Given an entry e1 holding graph files but no directory declared inside it
    When the entry's graph files are listed
    Then the list is empty

  @test:scripts/tests/library/library-entry-graphs.test.ts::entryGraphFiles::a_kind_that_is_not_within_library,_or_is_unpublished,_publishes_nothing
  Scenario: A kind not within library, or unpublished, publishes nothing
    Given out/ declared with a kind that is not within library
    Then the entry's graph files are empty
    And given out/ declared with a within-library kind marked unpublished
    Then the entry's graph files are empty

  @test:scripts/tests/library/library-entry-graphs.test.ts::entryGraphFiles::a_declaration_inside_ONE_entry_is_not_another_entry's
  Scenario: A declaration inside one entry is not another entry's
    Given a declared out/ directory inside entry e1
    When the graph files of entry e2 are listed
    Then the list is empty

  @test:scripts/tests/library/library-entry-graphs.test.ts::entryGraphSitePath::under_the_entry_IRI,_keeping_the_path_inside_the_entry
  Scenario: A graph file's site path sits under the entry IRI, keeping its path inside the entry
    Given instance "some-instance", entry "an-entry" and the file l1-extraction/recommendations.l1.json
    When its site path is computed
    Then it is assets/library/jsonld/some-instance/source/an-entry/l1-extraction/recommendations.l1.json

