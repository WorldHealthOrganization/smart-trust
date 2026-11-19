# uses[] parsing survives comments: a block whose array cannot be parsed
# contributes no edges, silently. Each Scenario names the test that executes it.
Feature: uses[] parsing and comments

  @test:scripts/tests/uses-field-comments.test.ts::uses[]_parsing_survives_comments::a_comment_between_the_previous_field_and_uses:_does_not_hide_the_array
  Scenario: A comment before uses: does not hide it
    Given a block with a line comment between "title" and "uses"
    Then extracting and parsing its uses give ["def:coulomb-charge"]

  @test:scripts/tests/uses-field-comments.test.ts::uses[]_parsing_survives_comments::labels_named_only_in_that_comment_are_not_picked_up_as_dependencies
  Scenario: Labels in the comment are not dependencies
    Then the parsed uses of that block do not include "def:crossing-energy"

  @test:scripts/tests/uses-field-comments.test.ts::uses[]_parsing_survives_comments::a_label_quoted_inside_a_comment_INSIDE_the_array_is_not_an_entry
  Scenario: A label in a comment inside the array is not an entry
    Given a uses array with a comment quoting "def:ghost"
    Then it parses as "def:a" and "def:b"

  @test:scripts/tests/uses-field-comments.test.ts::uses[]_parsing_survives_comments::the_field_boundary_still_keeps_causes/reuses_out
  Scenario: causes is not uses
    Then 'causes: ["def:not-this"], uses: ["def:this"]' parses as "def:this"

  @test:scripts/tests/uses-field-comments.test.ts::uses[]_parsing_survives_comments::a_uses:_quoted_inside_an_authorNotes_body_does_not_win
  Scenario: uses: inside a string does not win
    Then an authorNotes string containing 'uses: ["def:ghost"]' before the real uses parses as "def:real"

  @test:scripts/tests/uses-field-comments.test.ts::uses[]_parsing_survives_comments::no_uses_field_is_undefined,_not_an_empty_array
  Scenario: No uses field is undefined
    Then finding and extracting uses in a source with no uses field give undefined

  @test:scripts/tests/uses-field-comments.test.ts::maskComments::a_//_inside_a_string_literal_is_not_a_comment
  Scenario: "//" in a string is not a comment
    Then masking comments leaves a string holding a URL unchanged

  @test:scripts/tests/uses-field-comments.test.ts::maskComments::comments_are_blanked,_and_offsets_are_preserved
  Scenario: Line comments are blanked in place
    Then masking "a // note" then a newline and "b" gives spaces of the same length

  @test:scripts/tests/uses-field-comments.test.ts::maskComments::block_comments_are_blanked_across_lines,_keeping_newlines
  Scenario: Block comments are blanked across lines
    Then masking a block comment spanning two lines keeps the length and the newline and removes its text

  @test:scripts/tests/uses-field-comments.test.ts::maskComments::an_escaped_quote_does_not_end_the_string_early
  Scenario: An escaped quote does not end a string
    Then masking a string with an escaped quote then a comment keeps the string and removes the comment
