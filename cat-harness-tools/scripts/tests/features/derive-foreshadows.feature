# pipeline/qa-checkers-extended.ts reads the block labels a narrative mentions (parseMdBlockRefs)
# and derives a block's foreshadows: forward references that are not uses[] dependencies (deriveForeshadows).
# Each Scenario names the test that executes it.
Feature: Narrative block references and derived foreshadows

  @test:scripts/tests/derive-foreshadows.test.ts::parseMdBlockRefs::reads_markdown_links
  Scenario: A markdown link to a block anchor is read as a block reference
    Given the narrative "see [the thing](#prop:foo) for more"
    When its block references are parsed
    Then the result is ["prop:foo"]

  @test:scripts/tests/derive-foreshadows.test.ts::parseMdBlockRefs::reads_backtick_mentions
  Scenario: A backtick mention of a block label is read as a block reference
    Given the narrative "as `conj:bar` shows"
    When its block references are parsed
    Then the result is ["conj:bar"]

  @test:scripts/tests/derive-foreshadows.test.ts::parseMdBlockRefs::de-duplicates_across_both_forms
  Scenario: A label linked and mentioned several times is returned once
    Given a narrative that links "#prop:foo" twice and mentions `prop:foo` once
    When its block references are parsed
    Then the result is ["prop:foo"]

  @test:scripts/tests/derive-foreshadows.test.ts::parseMdBlockRefs::ignores_glossary_term_slugs_—_a_different_namespace
  Scenario: Glossary term slugs are not read as block references
    Given a narrative with a :refterm whose slug is "#braided-monoidal-category"
    When its block references are parsed
    Then the result is empty

  @test:scripts/tests/derive-foreshadows.test.ts::parseMdBlockRefs::ignores_prose_that_merely_looks_label-ish
  Scenario: Prose that merely looks like a label is not read as a block reference
    Given the narrative "ratio 3:4 and http://x.example/y"
    When its block references are parsed
    Then the result is empty

  @test:scripts/tests/derive-foreshadows.test.ts::parseMdBlockRefs::empty_narrative_yields_nothing
  Scenario: An empty narrative yields no block references
    Given an empty narrative
    When its block references are parsed
    Then the result is empty

  @test:scripts/tests/derive-foreshadows.test.ts::deriveForeshadows::keeps_a_forward_reference_that_is_not_a_dependency
  Scenario: A forward reference that is not a dependency is kept as a foreshadow
    Given the reading order rem:a, prop:b, thm:c, def:d
    And block "rem:a" whose narrative links "#thm:c" and whose uses[] is empty
    When its foreshadows are derived
    Then the result is ["thm:c"]

  @test:scripts/tests/derive-foreshadows.test.ts::deriveForeshadows::drops_a_BACKWARD_reference_—_a_foreshadow_must_point_forward
  Scenario: A backward reference is not a foreshadow
    Given the reading order rem:a, prop:b, thm:c, def:d
    And block "def:d" whose narrative links "#rem:a"
    When its foreshadows are derived
    Then the result is empty

  @test:scripts/tests/derive-foreshadows.test.ts::deriveForeshadows::drops_a_reference_already_declared_in_uses[]_—_that_is_a_dependency
  Scenario: A forward reference already declared in uses[] is not a foreshadow
    Given the reading order rem:a, prop:b, thm:c, def:d
    And block "rem:a" whose narrative links "#thm:c" and whose uses[] is ["thm:c"]
    When its foreshadows are derived
    Then the result is empty

  @test:scripts/tests/derive-foreshadows.test.ts::deriveForeshadows::drops_a_self-reference
  Scenario: A block's reference to itself is not a foreshadow
    Given block "rem:a" whose narrative links "#rem:a"
    When its foreshadows are derived
    Then the result is empty

  @test:scripts/tests/derive-foreshadows.test.ts::deriveForeshadows::drops_an_unresolvable_label_rather_than_inventing_a_pointer
  Scenario: A reference to an unknown label is dropped
    Given block "rem:a" whose narrative links "#prop:does-not-exist", a label not in the reading order
    When its foreshadows are derived
    Then the result is empty

  @test:scripts/tests/derive-foreshadows.test.ts::deriveForeshadows::a_block_with_no_reading-order_position_derives_nothing
  Scenario: A block with no reading-order position derives no foreshadows
    Given block "rem:unlisted", which has no reading-order position, linking "#thm:c"
    When its foreshadows are derived
    Then the result is empty

  @test:scripts/tests/derive-foreshadows.test.ts::deriveForeshadows::returns_sorted,_de-duplicated_results_across_both_ref_forms
  Scenario: Foreshadows are sorted and de-duplicated across links and mentions
    Given block "rem:a" whose narrative links "#thm:c" twice and mentions `def:d` and `thm:c`
    When its foreshadows are derived
    Then the result is ["def:d", "thm:c"]

  @test:scripts/tests/derive-foreshadows.test.ts::deriveForeshadows::derived_and_uses[]_are_disjoint_by_construction
  Scenario: Derived foreshadows never include a uses[] dependency
    Given block "rem:a" whose narrative links prop:b, thm:c and def:d and whose uses[] is ["prop:b"]
    When its foreshadows are derived
    Then the result is ["def:d", "thm:c"]
    And it does not contain "prop:b"
