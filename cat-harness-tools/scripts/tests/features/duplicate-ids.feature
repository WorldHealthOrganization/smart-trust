# scripts/check-duplicate-ids.ts counts duplicate ids in HTML tags only, never in text, code samples,
# script bodies or other attributes' values; and the generated navbar include renders its checkbox once.
# Each Scenario names the test that executes it.
Feature: Duplicate element ids

  @test:scripts/tests/duplicate-ids.test.ts::duplicateIds::two_elements_with_one_id_is_a_finding
  Scenario: Two elements with one id are a finding
    Given HTML with a div and an input both of id "a", and a p of id "b"
    When its duplicate ids are counted
    Then the only duplicate is "a", counted 2

  @test:scripts/tests/duplicate-ids.test.ts::duplicateIds::an_id_inside_a_code_sample_is_text,_not_markup_(the_two_first-run_false_hits)
  Scenario: An id inside a code sample is text, not markup
    Given an anchor of id "x" and two code samples showing escaped anchor tags with ids
    When its duplicate ids are counted
    Then there is no duplicate

  @test:scripts/tests/duplicate-ids.test.ts::duplicateIds::a_script_body_is_skipped,_but_the_script_tag's_own_id_counts_once
  Scenario: A script body is skipped, but the script tag's own id counts once
    Given a JSON script tag of id "meta" whose body mentions id "meta" twice
    When its duplicate ids are counted
    Then there is no duplicate

  @test:scripts/tests/duplicate-ids.test.ts::duplicateIds::single-quoted_and_unquoted_ids_are_read
  Scenario: Single-quoted and unquoted ids are read
    Given two elements, one with id 'q' single-quoted and one with id q unquoted
    When its duplicate ids are counted
    Then the only duplicate is "q", counted 2

  @test:scripts/tests/duplicate-ids.test.ts::only_an_attribute_named_id_counts::id=_inside_another_attribute's_value_is_text_(jekyll-seo-tag's_og:title,_folio-assistant#2628)
  Scenario: id= inside another attribute's value is text
    Given two meta tags whose content values both read "carry id=”x”"
    And two elements whose title values both read 'say id="y"'
    When their duplicate ids are counted
    Then there is no duplicate in either

  @test:scripts/tests/duplicate-ids.test.ts::only_an_attribute_named_id_counts::a_real_duplicate_after_other_attributes_is_still_found
  Scenario: A real duplicate after other attributes is still found
    Given two inputs of id "a", the second after a class and a data-id attribute
    When its duplicate ids are counted
    Then the duplicates are exactly "a", counted 2

  @test:scripts/tests/duplicate-ids.test.ts::only_an_attribute_named_id_counts::idOf_ignores_data-id_and_similar_names,_and_is_case-insensitive
  Scenario: idOf ignores data-id and similar names and reads ID case-insensitively
    When the id of a tag with only data-id and aria-labelledby is read
    Then it is undefined
    And the id of a tag with ID="u" is "u"
    And the id of an input with a bare attribute before id=bare is "bare"

  @test:scripts/tests/duplicate-ids.test.ts::the_generated_navbar_include:_one_checkbox,_labels_in_every_copy::the_checkbox_input_appears_once,_and_only_for_the_first_rendered_copy
  Scenario: The navbar include renders the checkbox input once, only for the first copy
    # Skipped: when the generated include docs/_includes/generated/navbar-footer.html is not built
    # Gap: a source-text check of the include, not of a rendered page
    Given the generated navbar include with its Liquid comments removed
    Then it holds exactly one input of class "fa-nav-open"
    And that input, of id "fa-nav-open", sits inside the condition "fa_nav_copy == 1"

  @test:scripts/tests/duplicate-ids.test.ts::the_generated_navbar_include:_one_checkbox,_labels_in_every_copy::no_label_drives_the_checkbox_here_—_the_theme's_avatar_is_the_control_(#1757)
  Scenario: No label drives the nav checkbox in either rendered variant
    # Skipped: when the generated include docs/_includes/generated/navbar-footer.html is not built
    # Gap: a source-text check; that the avatar toggles the checkbox is not checked
    Given the generated navbar include with its Liquid comments removed
    When it is split at its Liquid else into variants
    Then there are exactly two variants
    And neither holds a label for "fa-nav-open"
