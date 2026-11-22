# One Lean comment stripper, lean-lexer's (bean bqrg), and the invariants the
# reimplementations kept losing. Each Scenario names the test that executes it.
Feature: lean-lexer is the only Lean comment stripper

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::there_is_exactly_one_Lean_comment_stripper::the_scan_found_files_—_otherwise_nothing_below_proves_anything
  Scenario: The scan of this layer's modules found files
    When this layer's non-test .ts files outside node_modules are listed
    Then there are more than 200

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::there_is_exactly_one_Lean_comment_stripper::no_module_defines_its_own
  Scenario: No module defines its own stripper
    When every listed module other than the canonical lexer and the exempt delegate is read
    Then no code line defines a stripLeanComments function or binding

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::there_is_exactly_one_Lean_comment_stripper::an_exempt_delegate_only_forwards_to_the_slot
  Scenario: The exempt delegate only forwards to the lean-lexer slot
    When the delegate's stripLeanComments body is read
    Then it is exactly the return of the lean-lexer pipeline plugin's stripLeanComments

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::there_is_exactly_one_Lean_comment_stripper::...and_it_is_actually_used,_so_the_rule_is_not_vacuously_satisfied
  Scenario: The stripper is used from outside its module
    When the modules other than the canonical lexer that mention stripLeanComments are found
    Then there are at least four

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::the_invariants_a_reimplementation_kept_losing::byte_offsets_are_preserved_—_comments_blank,_never_delete
  Scenario: Byte offsets are preserved
    Given source with a line comment and a block comment
    When it is stripped
    Then the result has the source's length

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::the_invariants_a_reimplementation_kept_losing::LINE_COUNT_is_preserved_too_—_a_block_comment_keeps_its_newlines
  Scenario: The line count is preserved through a multi-line block comment
    Given a block comment spanning three lines between two definitions
    When it is stripped
    Then the result has the source's length and line count, and def b is on line 5

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::the_invariants_a_reimplementation_kept_losing::a_`/-!_…_-/`_module_header_does_not_shift_the_whole_file
  Scenario: A module header comment does not shift the file
    Given a /-! header spanning five lines before def c
    When it is stripped
    Then the result has six lines and def c is on line 6

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::the_invariants_a_reimplementation_kept_losing::a_restored_newline_yields_only_spaces_—_the_comment_is_still_blanked
  Scenario: A stripped multi-line comment is blank on every line
    Given a two-line block comment holding definitions, then a real definition
    When it is stripped
    Then both comment lines are blank and the third line holds def real

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::the_invariants_a_reimplementation_kept_losing::NESTED_block_comments_close_at_the_right_place
  Scenario: Nested block comments close at the right place
    Given a block comment with a nested block comment inside it
    When it is stripped
    Then neither "outer" nor "tail" survives, and def real does

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::the_invariants_a_reimplementation_kept_losing::doc_comments_are_comments_—_a_name_in_prose_is_not_a_dependency
  Scenario: Doc comments are stripped
    Given a doc comment naming Nonexistent.thing
    When it is stripped
    Then the name is gone and def real remains

  @test:scripts/tests/lean-lexer-is-the-only-stripper.test.ts::the_invariants_a_reimplementation_kept_losing::a_line_comment_does_not_eat_the_following_line
  Scenario: A line comment does not eat the following line
    Given a line comment followed by a definition
    When it is stripped
    Then the definition remains
