# uses[] is read out of .ts source by one parser, with a field boundary.
# Each Scenario names the test that executes it.
Feature: The uses[] field parser

  @test:scripts/tests/uses-field.test.ts::parseUsesField::reads_a_plain_array
  Scenario: A plain array is read
    Then 'uses: ["def:x", "thm:y"]' parses as "def:x" and "thm:y"

  @test:scripts/tests/uses-field.test.ts::parseUsesField::keeps_an_entry_containing_a_bracket
  Scenario: An entry with a bracket is kept
    Then 'uses: ["def:x[0]", "thm:y"]' parses as "def:x[0]" and "thm:y"

  @test:scripts/tests/uses-field.test.ts::parseUsesField::does_not_match_a_field_whose_name_merely_ENDS_in_`uses`
  Scenario: causes, misuses and reuses are not uses
    Then a block with causes, misuses or reuses before 'uses: ["def:real"]' parses as "def:real"

  @test:scripts/tests/uses-field.test.ts::parseUsesField::is_not_fooled_by_`uses:`_appearing_inside_a_string
  Scenario: "uses:" inside a string is ignored
    Then a statement string "this uses: nothing" and a tags array before the real uses parse as "def:real"

  @test:scripts/tests/uses-field.test.ts::parseUsesField::an_empty_array_stays_empty_and_does_not_borrow_a_later_one
  Scenario: An empty uses array stays empty
    Then 'uses: [], tags: ["not-a-dep"]' parses as an empty list

  @test:scripts/tests/uses-field.test.ts::parseUsesField::multiline_arrays,_trailing_commas,_single_quotes
  Scenario: Multiline arrays with trailing commas and single quotes
    Then a multiline uses array with a single-quoted entry and a trailing comma parses as "def:x" and "thm:y"

  @test:scripts/tests/uses-field.test.ts::parseUsesField::no_`uses`_field_at_all_yields_[]
  Scenario: No uses field parses as empty
    Then a block with only tags parses as an empty list

  @test:scripts/tests/uses-field.test.ts::parseUsesField::a_non-literal_`uses`_value_does_not_borrow_the_next_array
  Scenario: A non-literal uses value does not borrow
    Then 'uses: SHARED_DEPS, tags: ["not-a-dep"]' parses as an empty list

  @test:scripts/tests/uses-field.test.ts::findUsesField::distinguishes_an_absent_field_from_an_empty_one
  Scenario: An absent field is not an empty one
    Then finding uses in a block without it gives nothing
    And in a block with 'uses: []' gives empty entries

  @test:scripts/tests/uses-field.test.ts::findUsesField::offsets_bound_exactly_the_array_literal
  Scenario: The offsets bound the array literal
    Then the found array offsets slice '["def:x[0]"]' and the field offset starts "uses"

  @test:scripts/tests/uses-field.test.ts::replaceUsesArray_—_the_write_path::rewrites_uses[]_and_leaves_a_`causes:`_field_untouched
  Scenario: Replacing uses leaves causes alone
    When the uses array of a block with causes and uses is replaced with '["a"]'
    Then causes is unchanged, uses is '["a"]', and it parses as "a"

  @test:scripts/tests/uses-field.test.ts::replaceUsesArray_—_the_write_path::does_not_truncate_an_array_whose_entry_holds_a_bracket
  Scenario: Replacing an array with a bracketed entry keeps what follows
    When 'uses: ["def:x[0]", "thm:y"]' is replaced with '["def:x[0]"]'
    Then the following tags remain and it parses as "def:x[0]"

  @test:scripts/tests/uses-field.test.ts::replaceUsesArray_—_the_write_path::leaves_text_unchanged_when_there_is_no_uses_field
  Scenario: Replacing in a block with no uses changes nothing
    Then replacing uses in a block without it returns the same text

  @test:scripts/tests/uses-field.test.ts::replaceUsesArray_—_the_write_path::a_replace_round-trip_is_stable
  Scenario: Replacing twice is stable
    Then replacing with '["a"]' a second time returns the first result

  @test:scripts/tests/uses-field.test.ts::removeUsesField::removes_the_field_and_its_trailing_comma
  Scenario: Removing uses removes its comma and line
    When the uses field of a multiline block is removed
    Then no uses field remains, label and tags remain, and no blank line is left before tags

  @test:scripts/tests/uses-field.test.ts::removeUsesField::removes_only_the_uses_field,_not_a_similarly_named_one
  Scenario: Removing uses keeps causes
    When the uses field of a block with causes is removed
    Then causes remains and no uses field remains

  @test:scripts/tests/uses-field.test.ts::stripArrayField::strips_the_whole_array,_including_entries_holding_brackets
  Scenario: Stripping removes the whole array
    When uses is stripped from 'uses: ["def:x[0]", "lp-dual"], script: "s.py"'
    Then "lp-dual" is gone and the script field remains

  @test:scripts/tests/uses-field.test.ts::stripArrayField::strips_every_occurrence_and_terminates
  Scenario: Stripping removes every occurrence
    When cites is stripped from a source with two cites fields
    Then neither cited value remains and the other field does

  @test:scripts/tests/uses-field.test.ts::stripArrayField::leaves_a_similarly_named_field_alone
  Scenario: Stripping cites keeps recites
    When cites is stripped from 'recites: ["keep"], cites: ["drop"]'
    Then recites remains and "drop" is gone

  @test:scripts/tests/uses-field.test.ts::findArrayField_generalises_without_loosening_the_boundary::finds_a_named_field
  Scenario: A named array field is found
    Then finding "cites" in 'cites: ["bib:x"]' gives "bib:x"

  @test:scripts/tests/uses-field.test.ts::findArrayField_generalises_without_loosening_the_boundary::a_field_name_that_is_a_suffix_of_another_is_not_matched
  Scenario: A suffix of another field name is not matched
    Then finding "cites" in a block with only recites gives nothing
