# The foreshadows field of a block: parseForeshadows (pipeline/qa-checkers-extended) reads it from source, and the
# constraint rules "foreshadows-resolve" and "foreshadows-not-self" (schemas/constraints.ts) check its targets.
# Each Scenario names the test that executes it.
Feature: Foreshadows declarations are read and their targets checked

  @test:scripts/tests/foreshadows.test.ts::parseForeshadows::reads_a_single-line_declaration
  Scenario: parseForeshadows reads a single-line declaration
    Given a prose source declaring foreshadows ["def:x"] on one line
    When parseForeshadows reads it
    Then the result is ["def:x"]

  @test:scripts/tests/foreshadows.test.ts::parseForeshadows::reads_a_multi-line_declaration
  Scenario: parseForeshadows reads a multi-line declaration
    Given a prose source declaring foreshadows "def:x" and "thm:y" across several lines with a trailing comma
    When parseForeshadows reads it
    Then the result is ["def:x", "thm:y"]

  @test:scripts/tests/foreshadows.test.ts::parseForeshadows::absent_field_yields_nothing
  Scenario: parseForeshadows yields nothing when the field is absent
    Given a prose source declaring only uses ["def:x"]
    When parseForeshadows reads it
    Then the result is empty

  @test:scripts/tests/foreshadows.test.ts::parseForeshadows::empty_array_yields_nothing
  Scenario: parseForeshadows yields nothing for an empty array
    Given a prose source declaring foreshadows []
    When parseForeshadows reads it
    Then the result is empty

  @test:scripts/tests/foreshadows.test.ts::foreshadows-resolve::passes_when_the_target_exists_and_is_NOT_in_uses[]_—_the_case_the_old_rule_rejected
  Scenario: A resolving foreshadows target not in uses passes
    Given a prose block "rem:overview" foreshadowing "thm:later" with no uses
    And the label "thm:later" exists
    When the foreshadows-resolve rule checks it
    Then there is no finding

  @test:scripts/tests/foreshadows.test.ts::foreshadows-resolve::passes_when_the_target_exists_and_is_also_in_uses[]
  Scenario: A resolving foreshadows target also in uses passes
    Given a prose block "rem:a" with uses and foreshadows both ["thm:later"]
    And the label "thm:later" exists
    When the foreshadows-resolve rule checks it
    Then there is no finding

  @test:scripts/tests/foreshadows.test.ts::foreshadows-resolve::fails_on_a_target_that_does_not_resolve
  Scenario: A foreshadows target that does not resolve is a finding
    Given a prose block "rem:a" foreshadowing "thm:gone"
    And only the label "thm:other" exists
    When the foreshadows-resolve rule checks it
    Then the finding names "thm:gone"

  @test:scripts/tests/foreshadows.test.ts::foreshadows-resolve::skips_cross-paper_qualified_refs_—_resolved_at_folio_level
  Scenario: A cross-paper qualified foreshadows ref is skipped
    Given a prose block foreshadowing "unital-groebner-bases:cor:pbw"
    And no labels exist
    When the foreshadows-resolve rule checks it
    Then there is no finding

  @test:scripts/tests/foreshadows.test.ts::foreshadows-resolve::skips_full-URL_cross-folio_refs
  Scenario: A full-URL cross-folio foreshadows ref is skipped
    Given a prose block foreshadowing "https://folio.example.org/papers/foo#def:bar"
    And no labels exist
    When the foreshadows-resolve rule checks it
    Then there is no finding

  @test:scripts/tests/foreshadows.test.ts::foreshadows-resolve::reports_every_offender,_not_just_the_first
  Scenario: foreshadows-resolve reports every unresolved target
    Given a prose block foreshadowing "thm:x" and "def:y"
    And no labels exist
    When the foreshadows-resolve rule checks it
    Then the finding names "thm:x"
    And the finding names "def:y"

  @test:scripts/tests/foreshadows.test.ts::foreshadows-resolve::no_foreshadows_is_not_a_finding
  Scenario: A block with no foreshadows is not a foreshadows-resolve finding
    Given a prose block "rem:a" with no foreshadows field
    When the foreshadows-resolve rule checks it
    Then there is no finding

  @test:scripts/tests/foreshadows.test.ts::foreshadows-resolve::empty_foreshadows_is_not_a_finding
  Scenario: A block with empty foreshadows is not a foreshadows-resolve finding
    Given a prose block "rem:a" with foreshadows []
    When the foreshadows-resolve rule checks it
    Then there is no finding

  @test:scripts/tests/foreshadows.test.ts::foreshadows-not-self::fails_when_a_block_foreshadows_itself
  Scenario: A block that foreshadows itself is a finding
    Given a prose block "rem:a" foreshadowing "rem:a"
    When the foreshadows-not-self rule checks it
    Then the finding names "rem:a"

  @test:scripts/tests/foreshadows.test.ts::foreshadows-not-self::passes_when_it_foreshadows_something_else
  Scenario: A block that foreshadows something else passes foreshadows-not-self
    Given a prose block "rem:a" foreshadowing "thm:b"
    When the foreshadows-not-self rule checks it
    Then there is no finding

  @test:scripts/tests/foreshadows.test.ts::foreshadows-not-self::a_missing_label_is_not_a_finding_—_another_rule_owns_that
  Scenario: A block with no label is not a foreshadows-not-self finding
    Given a prose block with no label foreshadowing "thm:b"
    When the foreshadows-not-self rule checks it
    Then there is no finding
