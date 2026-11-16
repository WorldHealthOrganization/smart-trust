# splitDeclarations cuts each Lean declaration into signature and body at the
# first top-level := or where, never one nested inside the statement. Each
# Scenario names the test that executes it.
Feature: Splitting a Lean declaration at its top-level cut

  @test:scripts/tests/lean-decl-split.test.ts::topLevelCut::agrees_with_the_old_cut_on_every_already-correct_declaration
  Scenario: The cut agrees with the old cut on every already-correct declaration
    Given twelve declarations whose first := or where is already top-level
    When each is cut
    Then each cut equals the offset of the first := or where anywhere

  @test:scripts/tests/lean-decl-split.test.ts::topLevelCut::skips_`:=`_nested_in_brackets,_braces,_anonymous_constructors
  Scenario: A := nested in brackets, braces or a nested where is skipped
    Given declarations with := inside a let, a structure instance, a string and a parenthesised where
    When each is cut
    Then each signature ends just before the top-level :=

  @test:scripts/tests/lean-decl-split.test.ts::topLevelCut::skips_`:=`_inside_a_string_literal,_escapes_included
  Scenario: A := inside a string literal with an escaped quote is skipped
    Given a statement holding a string with an escaped quote and := inside it
    When it is cut
    Then the signature runs to the top-level := after the string

  @test:scripts/tests/lean-decl-split.test.ts::topLevelCut::does_not_treat_a_prime-suffixed_identifier_as_the_`where`_keyword
  Scenario: A prime-suffixed identifier is not the where keyword
    Given a binder named h'where
    When the declaration is cut
    Then the signature runs to the top-level :=

  @test:scripts/tests/lean-decl-split.test.ts::topLevelCut::returns_-1_when_there_is_no_top-level_cut_at_all
  Scenario: No top-level cut gives -1
    When a statement with no := is cut, or one whose every := is nested
    Then the cut is -1

  @test:scripts/tests/lean-decl-split.test.ts::topLevelCut::a_stray_closing_bracket_does_not_mask_every_later_cut
  Scenario: A stray closing bracket does not mask a later cut
    Given a statement with an unmatched closing parenthesis before its :=
    When it is cut
    Then the cut is a positive offset

  @test:scripts/tests/lean-decl-split.test.ts::topLevelCut::the_cut_always_lands_on_a_real_`:=`_or_`where`
  Scenario: Every cut lands on a real := or where
    When each sample declaration is cut
    Then every cut other than -1 is at a := or where in the source

  @test:scripts/tests/lean-decl-split.test.ts::splitDeclarations::body_starts_at_the_top-level_`:=`,_not_one_inside_the_statement
  Scenario: The body starts at the top-level :=
    Given a theorem whose statement holds a let with :=
    When it is split into declarations
    Then the signature holds the let and the body is ":= by rfl"

  @test:scripts/tests/lean-decl-split.test.ts::splitDeclarations::bodyAt_is_an_absolute_offset_that_slices_the_original_source
  Scenario: bodyAt is an absolute offset into the original source
    Given two declarations with identical bodies
    When they are split
    Then slicing the source at the second's bodyAt gives its body, and its bodyAt is after the first's

  @test:scripts/tests/lean-decl-split.test.ts::splitDeclarations::a_body-less_declaration_reports_bodyAt_-1,_not_0
  Scenario: A body-less declaration reports bodyAt -1
    When a theorem with no := is split
    Then its body is empty and its bodyAt is -1

  @test:scripts/tests/lean-decl-split.test.ts::splitDeclarations::offsets_survive_comment_stripping
  Scenario: Offsets survive comment stripping
    Given a doc comment holding := before a theorem
    When the comment-stripped text is split
    Then slicing the original source at bodyAt gives the body, which starts with :=
