# builtAtPublishDirectories in scripts/remote-mount.ts names the declared directories that are
# built at publish, so they are not "declared but absent" at a pin.
# Each Scenario names the test that executes it.
Feature: Directories built at publish

  @test:test/built-at-publish-directories.test.ts::builtAtPublishDirectories::names_a_directory_by_its_entry's_`directory`_or_by_its_path
  Scenario: A built-at-publish entry names a directory by its directory id or by its path
    Given a declaration with directories x-docs at "docs/", x-site at "site" and x-skills at "skills/"
    And builtAtPublish entries for a file "ns/context/v1.jsonld", "docs/" with directory "x-docs", and "./site/"
    When the built-at-publish directories are read
    Then they are exactly "x-docs" and "x-site"

  @test:test/built-at-publish-directories.test.ts::builtAtPublishDirectories::names_nothing_for_an_old_declaration,_or_text_that_is_not_JSON
  Scenario: An old declaration or non-JSON text names no directory
    Given a declaration with directories but no builtAtPublish, and the text "not json"
    When the built-at-publish directories are read from each
    Then both are empty
