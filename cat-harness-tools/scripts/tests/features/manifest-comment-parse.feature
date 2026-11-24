# Every blocks: [...] in a chapter manifest is read by masking strings and
# comments and depth-scanning for the close. Each Scenario names the test that
# executes it.
Feature: Reading a chapter manifest's block arrays

  @test:scripts/tests/manifest-comment-parse.test.ts::chapter-manifest_block_arrays::a_]_inside_a_comment_does_not_truncate_the_array
  Scenario: A ] inside a comment does not truncate the array
    Given a blocks array with a line comment holding "uses: []" between entries
    When its block arrays are read
    Then the array holds all three entries

  @test:scripts/tests/manifest-comment-parse.test.ts::chapter-manifest_block_arrays::a_slug_quoted_inside_a_comment_is_not_counted_as_a_block
  Scenario: A slug quoted inside a comment is not a block
    Given a blocks array with a comment quoting "ghost"
    When its block arrays are read
    Then the array holds only alpha and beta

  @test:scripts/tests/manifest-comment-parse.test.ts::chapter-manifest_block_arrays::every_section's_array_is_returned,_in_source_order
  Scenario: Every section's array is returned in source order
    Given sections and a subsection each with a blocks array
    When the block arrays are read
    Then the three arrays come back in source order

  @test:scripts/tests/manifest-comment-parse.test.ts::chapter-manifest_block_arrays::a_nested_array_does_not_end_the_scan_early
  Scenario: A nested array does not end the scan early
    Given a blocks array holding a nested array
    When the block arrays are read
    Then there is one array holding a, b, c and d

  @test:scripts/tests/manifest-comment-parse.test.ts::chapter-manifest_block_arrays::a_//_inside_a_string_literal_is_not_treated_as_a_comment
  Scenario: A // inside a string literal is not a comment
    Given a title holding a URL before a blocks array
    When the block arrays are read
    Then the array holds alpha

  @test:scripts/tests/manifest-comment-parse.test.ts::chapter-manifest_block_arrays::a_field_name_inside_a_string_does_not_win_over_the_real_one
  Scenario: A field name inside a string does not win over the real one
    Given a string quoting a blocks array before the real blocks field
    When the block arrays are read
    Then only the real array, holding alpha, is read

  @test:scripts/tests/manifest-comment-parse.test.ts::chapter-manifest_block_arrays::no_such_field_yields_nothing
  Scenario: No such field yields nothing
    When the block arrays of source with no blocks field are read
    Then there are none
