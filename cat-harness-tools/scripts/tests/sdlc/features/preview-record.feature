# scripts/preview-record.ts records what a preview build produced (a hash per file and the
# source tree) so an agent-built preview can be checked against a CI rebuild of the same tree.
# Each Scenario names the test that executes it.
Feature: Preview build records

  @test:scripts/tests/sdlc/preview-record.test.ts::a_record_of_what_a_preview_build_produced::hashes_every_file_but_the_build_facts,_and_names_the_tree
  Scenario: A record hashes every file except build facts and names the source tree
    Given a built site with index.html, a/b.css, staging.json and _render-log/x.json
    When a record is made for it from a committed repo
    Then the record's files are only "a/b.css" and "index.html"
    And its tree is a 40-hex-digit id
    And its digest is the digest of its files

  @test:scripts/tests/sdlc/preview-record.test.ts::a_record_of_what_a_preview_build_produced::two_builds_that_differ_only_in_their_build_facts_and_slug_edits_are_the_same
  Scenario: Two builds differing only in build facts and the staging marker are the same
    Given an agent build and a CI build whose staging.json differs and whose fa-staging meta content differs
    When the two records are compared
    Then they are reported as the same

  @test:scripts/tests/sdlc/preview-record.test.ts::a_record_of_what_a_preview_build_produced::any_other_difference_is_reported_by_path
  Scenario: Any other difference is reported by path
    Given an agent build with index.html, x.js and old.js
    And a CI build with a changed index.html, the same x.js and new.js
    When the two records are compared
    Then they are not the same
    And "index.html" is listed as changed
    And "old.js" is listed only in the claimed build
    And "new.js" is listed only in the rebuild
    And the comparison text says the rebuild "replaced it"

  @test:scripts/tests/sdlc/preview-record.test.ts::a_record_of_what_a_preview_build_produced::builds_of_different_trees_are_never_compared_file_by_file
  Scenario: Builds of different trees are never compared file by file
    Given a record and a copy of it naming a different tree
    When the two are compared
    Then they are not the same and are incomparable because of "different trees"
    And the comparison text calls the preview "stale"

  @test:scripts/tests/sdlc/preview-record.test.ts::a_record_of_what_a_preview_build_produced::an_empty_build_is_refused,_not_recorded
  Scenario: An empty build is refused rather than recorded
    Given a built site holding only staging.json
    When a record is made for it
    Then making the record fails with "no files"

  @test:scripts/tests/sdlc/preview-record.test.ts::a_record_of_what_a_preview_build_produced::a_record_whose_digest_does_not_match_its_files_is_refused
  Scenario: A record whose digest does not match its files is refused
    Given a record file whose files were altered after the digest was taken
    When the record is read
    Then reading fails with "digest"
    And an unaltered record file reads back with its digest

  @test:scripts/tests/sdlc/preview-record.test.ts::a_record_of_what_a_preview_build_produced::the_build-fact_list_is_fixed_in_code
  Scenario: The build-fact list is fixed in code
    Given the record file name, "_render-log/a" and "en/index.html"
    When each is checked for being a build fact
    Then the record file and the render-log path are build facts
    And "en/index.html" is not
