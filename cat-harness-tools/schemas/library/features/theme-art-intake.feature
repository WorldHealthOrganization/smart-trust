# schemas/library/theme-art-intake.ts: theme-art intake measures uploaded laptop, mobile and
# card art and emits the image declarations, refusing what would ship broken.
# Each Scenario names the test that executes it.
Feature: Theme-art intake

  @test:schemas/library/theme-art-intake.test.ts::the_happy_path_emits_a_declaration_rather_than_accepting_one::three_good_layouts_are_accepted
  Scenario: Three good layouts are accepted
    Given good laptop, mobile and card PNGs for role "landing-engineer" bound for "docs/assets/img/harness"
    When the art is ingested
    Then the intake is accepted

  @test:schemas/library/theme-art-intake.test.ts::the_happy_path_emits_a_declaration_rather_than_accepting_one::the_dimensions_are_MEASURED_—_the_caller_never_supplies_them
  Scenario: The dimensions are measured from the bytes, never supplied by the caller
    Given a laptop PNG whose header says 1671x941
    When the art is ingested
    Then the laptop image is declared 1671 wide and 941 high

  @test:schemas/library/theme-art-intake.test.ts::the_happy_path_emits_a_declaration_rather_than_accepting_one::one_declaration_per_layout,_under_the_requested_role
  Scenario: One declaration per layout, under the requested role
    Given three good layouts for role "landing-engineer"
    When the art is ingested
    Then exactly the layouts laptop, mobile and card are declared
    And every declared image has role "landing-engineer"

  @test:schemas/library/theme-art-intake.test.ts::the_happy_path_emits_a_declaration_rather_than_accepting_one::`src`_lands_under_the_destination_and_carries_the_measured_format
  Scenario: "src" lands under the destination and carries the measured format
    Given three good PNG layouts bound for "docs/assets/img/harness"
    When the art is ingested
    Then every image's src starts with "docs/assets/img/harness/"
    And every image's src ends with ".png"

  @test:schemas/library/theme-art-intake.test.ts::a_missing_layout_is_refused_—_the_landing-architecture_case::two_of_three_is_not_two_thirds_of_a_backdrop
  Scenario: Two of three layouts is refused as a missing layout
    Given good laptop and card art but no mobile art
    When the art is ingested
    Then the intake is refused
    And a "missing-layout" failure names the "mobile" layout

  @test:schemas/library/theme-art-intake.test.ts::a_missing_layout_is_refused_—_the_landing-architecture_case::the_remedy_says_WHY,_not_just_what
  Scenario: The missing-layout remedy says the theme renders with no art
    Given art with no mobile layout
    When the art is ingested
    Then the "missing-layout" failure's remedy contains "NO art"

  @test:schemas/library/theme-art-intake.test.ts::a_missing_layout_is_refused_—_the_landing-architecture_case::the_live_case_is_CLOSED_—_architecture_now_declares_all_three
  Scenario: The landing-architecture role now declares all three layouts
    Given the harness declaration
    When its images for role "landing-architecture" are read
    Then their layouts are exactly card, laptop and mobile

  @test:schemas/library/theme-art-intake.test.ts::byte-identical_files_are_refused_—_the_1b62b57_case::the_same_bytes_under_two_layouts_is_a_refusal,_not_a_warning
  Scenario: The same bytes under two layouts is a refusal, not a warning
    Given card and mobile art that are byte-identical
    When the art is ingested
    Then the intake is refused
    And the failures include "identical-content"

  @test:schemas/library/theme-art-intake.test.ts::byte-identical_files_are_refused_—_the_1b62b57_case::the_digest_distinguishes_files_that_differ_only_in_length
  Scenario: The content digest distinguishes files that differ only in length
    Given two 10x10 PNGs that differ only in padding length
    When each is digested
    Then the digests differ

  @test:schemas/library/theme-art-intake.test.ts::byte-identical_files_are_refused_—_the_1b62b57_case::and_agrees_with_itself
  Scenario: The content digest agrees with itself
    Given two identical 10x10 PNGs
    When each is digested
    Then the digests are equal

  @test:schemas/library/theme-art-intake.test.ts::orientation_is_checked,_because_a_crop_is_not_a_scale::a_landscape_file_offered_as_`mobile`_is_refused
  Scenario: A landscape file offered as mobile is refused
    Given a 1671x941 PNG offered as the mobile layout
    When the art is ingested
    Then the intake is refused
    And a "wrong-orientation" failure names "mobile" with a detail mentioning "1671"

  @test:schemas/library/theme-art-intake.test.ts::orientation_is_checked,_because_a_crop_is_not_a_scale::a_portrait_file_offered_as_`laptop`_is_refused
  Scenario: A portrait file offered as laptop is refused
    Given a 941x1670 PNG offered as the laptop layout
    When the art is ingested
    Then the intake is refused with a "wrong-orientation" failure for "laptop"

  @test:schemas/library/theme-art-intake.test.ts::orientation_is_checked,_because_a_crop_is_not_a_scale::a_non-square_file_offered_as_`card`_is_refused
  Scenario: A non-square file offered as card is refused
    Given a 1600x900 PNG offered as the card layout
    When the art is ingested
    Then the intake is refused with a "wrong-orientation" failure for "card"

  @test:schemas/library/theme-art-intake.test.ts::orientation_is_checked,_because_a_crop_is_not_a_scale::the_bands_accept_EVERY_layout_this_repository_already_ships
  Scenario: The aspect bands accept every layout the repository already ships
    Given the harness declaration's images with a width, a height and a theme layout
    When each image's aspect ratio is compared with its layout's band
    Then more than 8 such images exist
    And none falls outside its band

  @test:schemas/library/theme-art-intake.test.ts::the_destination_must_be_declared_—_the_0301fbd2_case::art_destined_for_the_repository_root_is_refused
  Scenario: Art destined for the repository root is refused
    Given three good layouts bound for "."
    When the art is ingested
    Then the intake is refused
    And the failures include "undeclared-destination"

  @test:schemas/library/theme-art-intake.test.ts::the_destination_must_be_declared_—_the_0301fbd2_case::a_subdirectory_of_a_declared_directory_is_accepted
  Scenario: A subdirectory of a declared directory is accepted
    Given three good layouts bound for "uploads/incoming/art" with "uploads/" declared
    When the art is ingested
    Then the intake is accepted

  @test:schemas/library/theme-art-intake.test.ts::the_destination_must_be_declared_—_the_0301fbd2_case::a_trailing_slash_does_not_change_the_answer
  Scenario: A trailing slash does not change the destination answer
    Given three good layouts bound for "uploads/" with "uploads" declared
    When the art is ingested
    Then the intake is accepted

  @test:schemas/library/theme-art-intake.test.ts::the_destination_must_be_declared_—_the_0301fbd2_case::a_sibling_that_merely_shares_a_prefix_is_NOT_inside
  Scenario: A sibling that merely shares a prefix is not inside a declared directory
    Given three good layouts bound for "uploads-old" with only "uploads" declared
    When the art is ingested
    Then the intake is refused
    And the failures include "undeclared-destination"

  @test:schemas/library/theme-art-intake.test.ts::weight_and_format_are_REPORTED,_not_refused::a_heavy_file_is_accepted_with_a_warning
  Scenario: A heavy file is accepted with a warning
    Given card art padded past the heavy-image byte budget
    When the art is ingested
    Then the intake is accepted
    And a "heavy" warning names the "card" layout

  @test:schemas/library/theme-art-intake.test.ts::weight_and_format_are_REPORTED,_not_refused::png_is_accepted,_with_webp_named_as_preferred
  Scenario: PNG is accepted, with WebP named as preferred
    Given three good PNG layouts
    When the art is ingested
    Then the intake is accepted
    And no "heavy" warning is given
    And a "not-preferred-format" warning is given

  @test:schemas/library/theme-art-intake.test.ts::weight_and_format_are_REPORTED,_not_refused::the_heavy_budget_sits_clear_of_both_measured_cases
  Scenario: The heavy budget sits between the measured WebP and PNG sizes
    When the heavy-image byte budget is read
    Then it is greater than 150000
    And it is less than 1000000

  @test:schemas/library/theme-art-intake.test.ts::an_unreadable_file_is_reported,_never_guessed::bytes_that_are_not_PNG_or_WebP_are_refused
  Scenario: Bytes that are not PNG or WebP are refused
    Given card art of five arbitrary bytes
    When the art is ingested
    Then the intake is refused
    And the failures include "unreadable"

  @test:schemas/library/theme-art-intake.test.ts::an_unreadable_file_is_reported,_never_guessed::`measureImage`_returns_undefined_rather_than_a_guess
  Scenario: measureImage returns undefined rather than a guess
    When four zero bytes, and then no bytes, are measured
    Then each measurement is undefined

  @test:schemas/library/theme-art-intake.test.ts::the_reader_is_checked_against_art_actually_on_disk::there_is_real_art_to_check
  Scenario: There is real art on disk to check
    Given the harness declaration's images with a src, a width and a height
    Then more than 8 such images exist

  @test:schemas/library/theme-art-intake.test.ts::the_reader_is_checked_against_art_actually_on_disk::every_declared_width_and_height_matches_the_file's_own_header
  Scenario: Every declared width and height matches the file's own header
    Given the harness declaration's images with a src, a width and a height
    When each file is read from disk and measured
    Then no image's measured size differs from its declared size
    And no image is unreadable or unmeasurable

  @test:schemas/library/theme-art-intake.test.ts::the_report_is_the_explanation,_not_the_word_`invalid`::every_failure_carries_a_remedy
  Scenario: Every intake failure carries a remedy
    Given art bound for "." with no mobile layout
    When the art is ingested
    Then the intake is refused with more than one failure
    And every failure's remedy is longer than 20 characters

  @test:schemas/library/theme-art-intake.test.ts::the_report_is_the_explanation,_not_the_word_`invalid`::ALL_failures_are_collected,_not_just_the_first
  Scenario: All intake failures are collected, not just the first
    Given art bound for "." with no mobile layout
    When the art is ingested
    Then the failures are of more than one kind

  @test:schemas/library/theme-art-intake.test.ts::the_report_is_the_explanation,_not_the_word_`invalid`::the_formatted_report_names_the_kind,_the_detail_and_the_remedy
  Scenario: The formatted report names the kind, the detail and the remedy
    Given art with no mobile layout, refused on intake
    When the intake report is formatted for "landing-engineer"
    Then the text contains "missing-layout"
    And it contains "mobile"
    And it contains the remedy arrow "→"

  @test:schemas/library/theme-art-intake.test.ts::the_report_is_the_explanation,_not_the_word_`invalid`::a_successful_report_lists_what_was_accepted
  Scenario: A successful report lists what was accepted
    Given three good layouts, accepted on intake
    When the intake report is formatted for "landing-engineer"
    Then the text contains "accepted"
    And it names each of laptop, mobile and card
