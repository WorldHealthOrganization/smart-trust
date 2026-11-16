# schemas/bean-and-declaration-kinds.test.ts checks that beans and layer declarations are
# node kinds by tag: "bean/1.0.0" in a bean's front matter, "cat-harness-declaration/1.0.0"
# in an <instance>.json. Each Scenario names the test that executes it.
Feature: Bean and instance-declaration node kinds

  @test:schemas/bean-and-declaration-kinds.test.ts::the_bean_kind::is_`bean/1.0.0`,_and_the_tag_constant_says_the_same
  Scenario: The bean kind's tag is "bean/1.0.0"
    Given the bean kind and the bean schema tag constant
    Then the kind's tag is "bean/1.0.0"
    And the tag constant equals the kind's tag

  @test:schemas/bean-and-declaration-kinds.test.ts::the_bean_kind::accepts_a_tagged_bean's_front_matter_and_refuses_an_untagged_one
  Scenario: The bean kind accepts tagged front matter and refuses an untagged one
    Given the bean kind's schema
    When front matter with "$schema" "bean/1.0.0", an id, a title and a status is parsed
    Then it is accepted
    And the same front matter without "$schema" is refused
    And front matter tagged "bean/2.0.0" is refused

  @test:schemas/bean-and-declaration-kinds.test.ts::the_instance-declaration_kind::is_`cat-harness-declaration/1.0.0`
  Scenario: The instance-declaration kind's tag is "cat-harness-declaration/1.0.0"
    Given the instance-declaration kind
    Then its tag equals the cat-harness declaration schema tag constant

  @test:schemas/bean-and-declaration-kinds.test.ts::the_instance-declaration_kind::a_parse_KEEPS_the_tag,_so_a_parse-and-write_does_not_lose_it
  Scenario: Parsing a tagged declaration keeps its tag
    Given a declaration named "alpha" at version "0.1.0" tagged with the declaration schema tag
    When it is parsed with the declaration schema
    Then the parsed "$schema" is still the declaration schema tag

  @test:schemas/bean-and-declaration-kinds.test.ts::the_instance-declaration_kind::an_untagged_declaration_still_parses_(the_retag_gate_is_what_fails_it);_another_major_does_not
  Scenario: An untagged declaration parses but another major version does not
    Given a declaration named "alpha" at version "0.1.0"
    When it is parsed with the declaration schema without a tag
    Then it is accepted
    And when tagged "cat-harness-declaration/2.0.0" it is refused

  @test:schemas/bean-and-declaration-kinds.test.ts::the_instance-declaration_kind::the_kind_requires_the_tag_and_runs_the_same_cross-field_checks_as_the_schema
  Scenario: The declaration kind requires the tag
    # Gap: the cross-field checks the title mentions are not exercised; only the tag requirement is
    Given a declaration named "alpha" at version "0.1.0"
    When it is parsed with the declaration kind's schema without a tag
    Then it is refused
    And with the declaration schema tag it is accepted

  @test:schemas/bean-and-declaration-kinds.test.ts::the_node-kind_index::finds_the_bean_kind_through_the_bean-defs_typology
  Scenario: The node-kind index finds the bean kind through the bean-defs typology
    Given the node-kind index built over the default graph typologies of the harness checkout
    When the "bean" kind is looked up
    Then its holdings are exactly the "bean-defs" typology

  @test:schemas/bean-and-declaration-kinds.test.ts::the_node-kind_index::finds_the_declaration_kind_by_its_name_rule,_declared_by_cat-harness
  Scenario: The node-kind index finds the declaration kind by its name rule
    Given the node-kind index built over the default graph typologies of the harness checkout
    When the "cat-harness-declaration" kind is looked up
    Then it is found by "instance-declaration", declared by "cat-harness", with no holdings

  @test:schemas/bean-and-declaration-kinds.test.ts::the_node-kind_index::bean-defs_is_no_longer_an_unkinded_typology
  Scenario: The bean-defs typology is no longer unkinded
    Given the node-kind index built over the default graph typologies of the harness checkout
    Then no unkinded entry names the "bean-defs" typology
