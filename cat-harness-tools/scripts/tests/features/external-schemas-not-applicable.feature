# external-schemas:check (scripts/external-schemas.ts) excuses, in a content root, a mounted layer's record whose terms are
# derived from the whole checkout, with a reason; the root's own registry and every harness root are judged as before.
# Each Scenario names the test that executes it.
Feature: Composed external-schema terms are not applicable in a content root

  @test:scripts/tests/external-schemas-not-applicable.test.ts::composed_operative_terms_of_a_mounted_layer's_record::only_the_whole-checkout_derivers_are_composed;_the_harness's_own_BPMN_deriver_is_not
  Scenario: Only the whole-checkout derivers are composed
    Then the composed derivers are exactly "dcmi-terms" and "w3c-skos"

  @test:scripts/tests/external-schemas-not-applicable.test.ts::composed_operative_terms_of_a_mounted_layer's_record::content_root_+_a_mounted_layer's_registry:_not_applicable,_with_a_reason
  Scenario: A mounted layer's registry in a content root is not applicable, with a reason
    Given a root with no code-quality-gates workflow
    When the registry "cat-harness/external-schemas" under it is judged
    Then the not-applicable reason mentions "content root"

  @test:scripts/tests/external-schemas-not-applicable.test.ts::composed_operative_terms_of_a_mounted_layer's_record::a_registry_at_the_content_root_itself_is_still_judged
  Scenario: A registry at the content root itself is still judged
    Given a root with no code-quality-gates workflow
    When the registry "external-schemas" at that root is judged
    Then no not-applicable reason is given

  @test:scripts/tests/external-schemas-not-applicable.test.ts::composed_operative_terms_of_a_mounted_layer's_record::a_harness_root_judges_the_mounted_registry_as_before
  Scenario: A harness root judges a mounted layer's registry
    Given a root with a ".github/workflows/code-quality-gates.yml" workflow
    When the registry "cat-harness/external-schemas" under it is judged
    Then no not-applicable reason is given
