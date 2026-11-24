# scripts/pc-release.ts freezes a public comment release at PC/<version>/ on the publish branch,
# never rewrites it, and closes it by its record only; no publish path deletes it.
# Each Scenario names the test that executes it.
Feature: Public comment releases are frozen and kept

  @test:scripts/tests/sdlc/pc-release.test.ts::freeze::copies_the_preview_to_PC/<version>/,_rewrites_its_own_links,_swaps_the_banner,_records_every_file
  Scenario: Freezing copies the preview to PC/<version>/, rewrites its links, swaps the banner and records every file
    Given a publish branch with a staged preview of en/doc under STAGING/claude-draft and a PDF
    When version v0.9 is frozen from it, closing 2026-12-01
    Then the frozen page's canonical link is under PC/v0.9/en/doc/ and no longer names STAGING/claude-draft
    And the staging banner is replaced by the release banner, which links the release's PDF
    And staging.json is not copied
    And the release is open and records exactly the PDF and en/doc/index.html
    And verifying it finds nothing changed, missing or added
    And the PC index lists the one release v0.9

  @test:scripts/tests/sdlc/pc-release.test.ts::freeze::refuses_a_preview_build:_a_public_comment_release_is_a_full_build_(owner,_2026-11-01)
  Scenario: A preview build is refused, since a public comment release is a full build
    Given a staged copy whose staging.json says buildType "preview"
    When version v1 is frozen from it
    Then it throws naming the preview build
    And PC/v1 does not exist

  @test:scripts/tests/sdlc/pc-release.test.ts::freeze::records_the_build_type_it_froze:_full,_or_unstated_for_a_copy_built_before_the_switch
  Scenario: The release records the build type it froze, full or unstated
    Given a staged copy whose staging.json states no build type
    When version v1 is frozen
    Then its recorded build is "unstated"
    And after staging.json says buildType "full", version v2 is recorded with build "full"

  @test:scripts/tests/sdlc/pc-release.test.ts::freeze::refuses_a_version_that_already_exists:_a_release_is_never_overwritten
  Scenario: A version that already exists is refused, so a release is never overwritten
    Given version v1 already frozen
    When v1 is frozen again
    Then it throws saying a release is never overwritten

  @test:scripts/tests/sdlc/pc-release.test.ts::freeze::refuses_a_version_that_is_not_one_path_segment
  Scenario: A version that is not one path segment is refused
    Given a staged preview
    When the versions "../x", "a/b", ".." and "" are each frozen
    Then each throws

  @test:scripts/tests/sdlc/pc-release.test.ts::freeze::verify_names_a_file_changed_after_the_release
  Scenario: Verify names a file changed after the release
    Given version v2 frozen
    When its en/doc/index.html is overwritten
    Then verifying v2 reports "en/doc/index.html" as changed

  @test:scripts/tests/sdlc/pc-release.test.ts::close::changes_only_the_record,_never_the_pages
  Scenario: Closing a release changes only its record, never its pages
    Given version v3 frozen
    When it is closed with a log URL on 2026-12-02
    Then its status is closed and its record carries the log URL
    And verifying it finds nothing changed, missing or added

  @test:scripts/tests/sdlc/pc-release.test.ts::no_publish_path_removes_a_release::the_main_publish_never_writes_or_deletes_PC/
  Scenario: The main publish never writes or deletes PC/
    Given version v0.9 frozen on a publish branch
    And a main site published there with "index.html" and "gone.html"
    When the main site is published again without "gone.html"
    Then the publish removes the two files its manifest named and "gone.html" is gone
    And the frozen release is byte-identical and verifying it finds nothing changed, missing or added
    And a site that writes into PC/ is refused as writing into reserved paths
    And a manifest that names a file under PC/ is refused as not the main site's to delete
    And the release still verifies unchanged

  @test:scripts/tests/sdlc/pc-release.test.ts::no_publish_path_removes_a_release::a_full-replace_deploy_carries_PC/
  Scenario: A full-replace deploy carries PC/
    Given a gh-pages branch holding "PC/v0.9/index.html" and an old home page
    And a freshly built site with a new home page and no PC/
    When restore-staging runs against the branch before the deploy
    Then it reports PC as carried
    And the built site now holds the frozen "PC/v0.9/index.html" unchanged
    And the built site's own home page is not overwritten

  @test:scripts/tests/sdlc/pc-release.test.ts::bannerInto::puts_the_banner_after_<body>_once
  Scenario: The release banner goes after <body> once
    Given a page with a classed body tag
    When the release banner is put into it
    Then the banner sits right after the body tag
    And putting another release banner into that page leaves it unchanged

  @test:scripts/tests/sdlc/pc-release.test.ts::pagesOfLines_reads_the_gutter_numbers_back_from_pdftotext::every_number_in_order,_with_its_page
  Scenario: pdftotext gutter numbers are read back in order with their page
    Given pdftotext output with lines numbered 1 to 4 over two pages, one line starting "4 apples"
    When the pages of 4 lines are read
    Then none is missing
    And lines 1 to 4 are on pages 1, 1, 2 and 2

  @test:scripts/tests/sdlc/pc-release.test.ts::pagesOfLines_reads_the_gutter_numbers_back_from_pdftotext::one_unread_number_is_reported,_and_the_rest_are_still_found
  Scenario: One unread gutter number is reported and the rest are still found
    Given pdftotext output numbering lines 1, 3 and 4 with line 2 unnumbered
    When the pages of 4 lines are read
    Then line 2 is missing
    And line 4 is on page 1

  @test:scripts/tests/sdlc/pc-release.test.ts::pagesOfLines_reads_the_gutter_numbers_back_from_pdftotext::a_number_in_the_text_that_is_not_the_next_line_is_not_taken_for_one
  Scenario: A number in the text that is not the next line number is not taken for one
    Given pdftotext output with line 1, a line "2024 was a year" and line 2
    When the pages of 2 lines are read
    Then none is missing
