Feature: listing a library's entries

  @test:scripts/lib/library-entries.test.ts::libraryEntries::flatLibrarySorted
  Scenario: a flat library lists its subdirectories, sorted, and skips hidden ones
    When a flat library is listed
    Then its subdirectories are sorted and hidden ones skipped

  @test:scripts/lib/library-entries.test.ts::libraryEntries::filedAndUnfiledTogether
  Scenario: filed and unfiled entries are listed together, and a group is never an entry
    When a library with groups kg and process and an unfiled entry is listed
    Then the filed and unfiled entries are listed together, never a group
    And a filed entry names its directory and group

  @test:scripts/lib/library-entries.test.ts::libraryEntries::undeclaredGroupNameIsEntry
  Scenario: an undeclared directory is an entry even when its name is a group code
    When a library with an undeclared directory named kg is listed
    Then kg is an entry

  @test:scripts/lib/library-entries.test.ts::libraryEntries::absentLibraryNothing
  Scenario: an absent library lists nothing
    When a library that does not exist is listed
    Then nothing is listed
