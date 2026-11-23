# What scripts/check-agents-claims.ts does: read the location claims ("`sym` in `module`") and absence claims ("`sym` has no caller")
# that AGENTS.md makes about code, and check each against the tree, counting only production code as a caller.
# Each Scenario names the test that executes it.
Feature: Checking the claims AGENTS.md makes about code

  @test:scripts/tests/agents-claims.test.ts::parsing_—_a_claim_must_carry_a_backticked_symbol_and_a_shape::a_location_claim_is_read,_symbol_and_module
  Scenario: A location claim is read with its symbol and module
    When "`foo` in `schemas/types.ts` is the thing." is parsed for location claims
    Then there is one location claim with symbol "foo", module "schemas/types.ts" and sentence "`foo` in `schemas/types.ts`"

  @test:scripts/tests/agents-claims.test.ts::parsing_—_a_claim_must_carry_a_backticked_symbol_and_a_shape::a_claim_spanning_a_BLOCKQUOTE_line_break_is_still_one_claim
  Scenario: A claim broken across blockquote lines is still one claim
    When a claim split over two "> " blockquote lines is parsed for location claims
    Then exactly one claim is found

  @test:scripts/tests/agents-claims.test.ts::parsing_—_a_claim_must_carry_a_backticked_symbol_and_a_shape::coordination_without_a_comma_is_one_claim_about_two_symbols
  Scenario: Two symbols joined by "and" without a comma are both claimed in the module
    When "`A` and `B` in `schemas/types.ts`" is parsed for location claims
    Then the symbols are "A" and "B"
    And both are claimed in "schemas/types.ts"

  @test:scripts/tests/agents-claims.test.ts::parsing_—_a_claim_must_carry_a_backticked_symbol_and_a_shape::a_COMMA_before_`and`_is_a_clause_boundary,_not_a_list
  Scenario: A comma before "and" ends the clause, so the earlier symbol is not claimed
    When "`DocumentContentAdapter` extends it, and `X` in `schemas/content/block-kinds.ts`" is parsed for location claims
    Then only "X" is claimed

  @test:scripts/tests/agents-claims.test.ts::parsing_—_a_claim_must_carry_a_backticked_symbol_and_a_shape::prose_with_no_backticked_symbol_yields_no_claim_—_it_is_NOT_verified
  Scenario: Prose with no backticked symbol yields no claim
    When "the overlay is computed in the config schema" is parsed for location claims
    Then no claim is found
    And "nothing calls it any more" yields no absence claim

  @test:scripts/tests/agents-claims.test.ts::parsing_—_a_claim_must_carry_a_backticked_symbol_and_a_shape::fenced_code_is_not_prose
  Scenario: Fenced code is not read for claims
    When a fenced ts block mentioning "`schemas/types.ts`" is parsed for location claims
    Then no claim is found

  @test:scripts/tests/agents-claims.test.ts::parsing_—_a_claim_must_carry_a_backticked_symbol_and_a_shape::an_absence_claim_is_read
  Scenario: An absence claim is read
    When "`resolveSkillDirs` computes the overlay and has no caller." is parsed for absence claims
    Then there is one absence claim about "resolveSkillDirs"

  @test:scripts/tests/agents-claims.test.ts::parsing_—_a_claim_must_carry_a_backticked_symbol_and_a_shape::an_absence_sentence_naming_TWO_symbols_is_NOT_guessed_at
  Scenario: An absence sentence naming two symbols yields no claim
    When "`a` and `b`: nothing calls it." is parsed for absence claims
    Then no claim is found

  @test:scripts/tests/agents-claims.test.ts::parsing_—_a_claim_must_carry_a_backticked_symbol_and_a_shape::each_absence_phrasing_the_file_actually_uses_is_recognised
  Scenario: Each absence phrasing the file uses is recognised
    When "`sym`" followed by "has no caller", "nothing calls it", "not yet reachable" or "is never called" is parsed for absence claims
    Then each yields exactly one claim

  @test:scripts/tests/agents-claims.test.ts::resolution::a_module_is_resolved_against_each_root_a_path_may_be_written_from
  Scenario: A cited module resolves through this layer, and a missing module resolves nowhere
    Given this repository
    Then the cited module "schemas/kg/cat-harness.ts" resolves
    And "schemas/no-such-module.ts" resolves neither against the checkout nor as a cited module

  @test:scripts/tests/agents-claims.test.ts::resolution::`declares`_finds_each_declaration_form,_and_misses_none_of_them
  Scenario: declares recognises every exported declaration form
    Then "export <form> Foo" declares "Foo" for each of const, function, class, interface, type and enum
    And "export const Bar = 1" does not declare "Foo"

  @test:scripts/tests/agents-claims.test.ts::resolution::`A.B`_asks_for_a_member_of_`A`
  Scenario: A dotted name asks for a member of the declared type
    Given "export interface BlockBase { uses: string[] }"
    Then it declares "BlockBase.uses"
    And it does not declare "BlockBase.gone"

  @test:scripts/tests/agents-claims.test.ts::callers_—_comments_are_not_calls::a_mention_in_a_comment_is_not_a_caller
  Scenario: A mention in a comment is not a caller
    Given a scratch tree where "schemas/a.ts" declares "target" and "prose.ts" mentions it only in comments
    When the callers of "target" are found
    Then they are only "schemas/a.ts"

  @test:scripts/tests/agents-claims.test.ts::callers_—_comments_are_not_calls::a_real_reference_in_code_IS_a_caller
  Scenario: A real reference in code is a caller
    Given the same scratch tree plus "user.ts", which imports and calls "target"
    When the callers of "target" are found
    Then they are "schemas/a.ts" and "user.ts"

  @test:scripts/tests/agents-claims.test.ts::the_two_false_claims_from_git_history_—_the_bean's_done-when_#3::the_stale_module_path_is_caught
  Scenario: The historical claim's stale module path is reported
    Given the historical claim that "resolveSkillDirs" is in "schemas/folio-config.ts" and has no caller
    When it is checked against this repository
    Then a finding says "no such module: schemas/folio-config.ts"

  @test:scripts/tests/agents-claims.test.ts::the_two_false_claims_from_git_history_—_the_bean's_done-when_#3::the_`no_caller`_half_is_caught_SEPARATELY_—_a_location_check_alone_would_have_missed_it
  Scenario: A false "no caller" claim is reported on its own, naming the real caller
    When "`resolveSkillDirs` has no caller." is checked against this repository
    Then there is exactly one finding
    And it names "skill-packages"

  @test:scripts/tests/agents-claims.test.ts::the_two_false_claims_from_git_history_—_the_bean's_done-when_#3::a_TRUE_location_claim_about_today's_tree_passes
  Scenario: A true location claim about the current tree passes
    When "`resolveSkillDirs` in `schemas/kg/harness-config.ts` does it." is checked against this repository
    Then one claim is read
    And there are no findings

  @test:scripts/tests/agents-claims.test.ts::the_two_exclusions,_each_of_which_would_invert_a_true_claim::a_symbol_referenced_ONLY_in_its_own_declaration_still_has_no_caller
  Scenario: A symbol referenced only in its own declaration still has no caller
    Given a scratch tree where "scripts/lonely.ts" declares "lonely" and refers to it only inside itself
    When "`lonely` has no caller." is checked
    Then there are no findings

  @test:scripts/tests/agents-claims.test.ts::the_two_exclusions,_each_of_which_would_invert_a_true_claim::a_symbol_exercised_only_by_its_TEST_still_has_no_caller
  Scenario: A symbol exercised only by its test still has no caller
    Given the scratch tree plus "scripts/tests/lonely.test.ts", which imports and calls "lonely"
    When "`lonely` has no caller." is checked
    Then there are no findings

  @test:scripts/tests/agents-claims.test.ts::the_two_exclusions,_each_of_which_would_invert_a_true_claim::...and_a_PRODUCTION_caller_does_refute_it,_counting_the_test_separately
  Scenario: A production caller refutes the claim, with the test counted separately
    Given the scratch tree with the test file and "scripts/real.ts", which imports and calls "lonely"
    When "`lonely` has no caller." is checked
    Then there is exactly one finding
    And it names "scripts/real.ts" and "1 test file(s)"

  @test:scripts/tests/agents-claims.test.ts::this_repository,_right_now::every_claim_AGENTS.md_makes_about_code_holds
  Scenario: Every claim this layer's AGENTS.md makes about code holds
    Given this layer's AGENTS.md
    When its claims are checked against this repository
    Then there are no findings, and any finding fails the test naming its symbol and reason

  @test:scripts/tests/agents-claims.test.ts::this_repository,_right_now::a_NON-TRIVIAL_number_of_claims_is_parsed_—_zero_parsed_is_not_zero_false
  Scenario: More than three claims are parsed from this layer's AGENTS.md
    Given this layer's AGENTS.md
    When its claims are checked against this repository
    Then more than 3 claims are read
