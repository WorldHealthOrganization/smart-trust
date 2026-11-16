# The `appliesTo` lists of the constraint rules validate.ts runs (allConstraintRules from
# schemas/content/vocabulary-modules.ts), checked against BLOCK_KINDS, plus the cites-resolve rule.
# Each Scenario names the test that executes it.
Feature: Constraint rules apply to every block kind unless documented otherwise

  @test:scripts/tests/constraint-applies-to.test.ts::constraint_appliesTo_coverage::every_rule_is_either_universal_or_listed_as_kind-specific
  Scenario: A rule that skips any block kind must be listed as kind-specific
    Given every constraint rule and every block kind
    When the kinds each rule's appliesTo omits are collected
    Then every rule that omits a kind is listed as kind-specific or as a shared copy of one

  @test:scripts/tests/constraint-applies-to.test.ts::constraint_appliesTo_coverage::each_kind-specific_rule_matches_its_documented_scope_exactly
  Scenario: Each kind-specific rule covers exactly its documented kinds
    Given the kind-specific list, such as "lean-file-exists" for "definition" only
    When each listed rule whose kinds are in scope is looked up
    Then the rule exists
    And the kinds covered by it and its shared copies equal the documented kinds

  @test:scripts/tests/constraint-applies-to.test.ts::constraint_appliesTo_coverage::rules_checking_a_BlockBase_field_apply_to_every_kind
  Scenario: Rules on BlockBase fields apply to every block kind
    Given the rules "cites-resolve", "simulator-ref-resolve" and "uses-resolve"
    Then each one's appliesTo omits no block kind

  @test:scripts/tests/constraint-applies-to.test.ts::constraint_appliesTo_coverage::md-crossref-resolve_covers_every_kind_that_can_have_an_.md
  Scenario: md-crossref-resolve covers proof, algorithm and table blocks
    # Gap: only three kinds are checked, not every kind that can have an .md
    Given the rule "md-crossref-resolve"
    Then its appliesTo contains "proof", "algorithm" and "table"

  @test:scripts/tests/constraint-applies-to.test.ts::constraint_appliesTo_coverage::no_rule_lists_a_kind_that_is_not_a_block_kind
  Scenario: No rule names a kind that is not a block kind
    Given every constraint rule
    Then every kind in each rule's appliesTo is a block kind

  @test:scripts/tests/constraint-applies-to.test.ts::cites-resolve_actually_fires_now::catches_a_bad_citation_key_on_a_`table`_block
  Scenario: cites-resolve reports an unknown citation key on a table block
    Given a context whose reference ids are "knuth1984"
    And a table block citing "nosuchkey"
    When cites-resolve checks it
    Then it returns a message naming "nosuchkey"

  @test:scripts/tests/constraint-applies-to.test.ts::cites-resolve_actually_fires_now::accepts_a_good_key,_on_the_same_previously-excluded_kind
  Scenario: cites-resolve accepts a known citation key on a table block
    Given a context whose reference ids are "knuth1984"
    And a table block citing "knuth1984"
    When cites-resolve checks it
    Then it returns null

  @test:scripts/tests/constraint-applies-to.test.ts::cites-resolve_actually_fires_now::still_no-ops_for_a_block_with_no_cites[]
  Scenario: cites-resolve passes a block with no cites
    Given a table block with no cites
    When cites-resolve checks it
    Then it returns null

  @test:scripts/tests/constraint-applies-to.test.ts::cites-resolve_actually_fires_now::no-ops_when_allRefIds_is_absent_—_which_is_why_it_never_fired
  Scenario: cites-resolve passes everything when the context has no reference ids
    Given a context without allRefIds
    And a theorem block citing "nosuchkey"
    When cites-resolve checks it
    Then it returns null
