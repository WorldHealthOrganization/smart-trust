# Manifest string arrays are read by masking strings and comments, never by
# stripping them. Each Scenario names the test that executes it.
Feature: Reading a manifest's string arrays

  @test:scripts/tests/manifest-parse.test.ts::maskStringsAndComments::preserves_length_and_newlines_so_indices_stay_valid
  Scenario: Masking preserves length and newlines
    When source with a string and a line comment is masked
    Then the result has the same length and line count

  @test:scripts/tests/manifest-parse.test.ts::maskStringsAndComments::blanks_string_contents_but_keeps_the_quotes
  Scenario: Masking blanks string contents but keeps the quotes
    When x = "abc" is masked
    Then it reads x = "   "

  @test:scripts/tests/manifest-parse.test.ts::maskStringsAndComments::does_NOT_corrupt_a_URL_inside_a_string_—_the_reason_this_masks_rather_than_strips
  Scenario: A URL inside a string is not corrupted
    When a uses array holding an https URL is read
    Then the URL is read whole

  @test:scripts/tests/manifest-parse.test.ts::maskStringsAndComments::blanks_line_and_block_comments
  Scenario: Line and block comments are blanked
    When a line comment and a block comment are masked
    Then each becomes spaces, the newline kept

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::reads_a_plain_array
  Scenario: A plain array is read
    When uses: ["def:a", "thm:b"] is read
    Then it gives def:a and thm:b

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::mode_1_—_a_quoted_string_in_a_comment_is_NOT_an_entry
  Scenario: A quoted string in a comment is not an entry
    Given a uses array whose comment quotes a phrase
    When it is read
    Then only the two real entries are read

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::mode_2_—_a_quoted_`uses:_[...]`_earlier_in_the_file_does_not_win
  Scenario: A quoted uses array earlier in the file does not win
    Given an authorNotes body quoting a uses array before the real uses field
    When uses is read
    Then it gives only prop:real

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::mode_3_—_a_closing_bracket_in_a_comment_does_NOT_truncate
  Scenario: A closing bracket in a comment does not truncate
    Given a foreshadows array with a comment holding uses[] between entries
    When foreshadows is read
    Then all three entries are read

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::does_not_match_a_field_whose_name_merely_ends_with_the_target
  Scenario: A field whose name merely ends with the target does not match
    When uses is read from notuses and uses arrays
    Then it gives only the uses entry

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::handles_a_nested_array_without_stopping_at_its_inner_bracket
  Scenario: A nested array does not stop the scan
    When a uses array holding a nested array is read
    Then all three strings are read

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::absent_field_yields_nothing
  Scenario: An absent field yields nothing
    When uses is read from source with only tags
    Then nothing is read

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::empty_array_yields_nothing
  Scenario: An empty array yields nothing
    When uses: [] is read
    Then nothing is read

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::an_unterminated_array_yields_nothing_rather_than_running_away
  Scenario: An unterminated array yields nothing
    When a uses array with no closing bracket is read
    Then nothing is read

  @test:scripts/tests/manifest-parse.test.ts::parseManifestStringArray::single_quotes_are_accepted,_matching_the_old_behaviour
  Scenario: Single quotes are accepted
    When uses: ['def:a'] is read
    Then it gives def:a
