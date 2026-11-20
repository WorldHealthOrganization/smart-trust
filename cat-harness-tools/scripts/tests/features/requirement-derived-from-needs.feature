# A requirement's derivedFrom resolves against the layer and everything it
# needs (bean w1gy). A synthetic layer "top" needs "base"; base declares
# req:base-parent; top declares req:from-below (derived from it) and
# req:from-nowhere (derived from a requirement no layer declares). kg-audit
# runs on top. Each Scenario names the test that executes it.
Feature: A requirement's derivedFrom resolves across the needs chain

  @test:scripts/tests/requirement-derived-from-needs.test.ts::requirement_`derivedFrom`_resolves_across_the_`needs`_chain::only_`top`'s_own_requirements_are_subjects
  Scenario: Only top's own requirements are audited
    Then the requirement subjects are "req:from-below" and "req:from-nowhere"

  @test:scripts/tests/requirement-derived-from-needs.test.ts::requirement_`derivedFrom`_resolves_across_the_`needs`_chain::a_parent_a_needed_layer_declares_resolves
  Scenario: A parent a needed layer declares resolves
    Then requirement-derived-from-resolves passes for "req:from-below"

  @test:scripts/tests/requirement-derived-from-needs.test.ts::requirement_`derivedFrom`_resolves_across_the_`needs`_chain::a_parent_no_layer_declares_is_still_reported
  Scenario: A parent no layer declares is still reported
    Then requirement-derived-from-resolves fails for "req:from-nowhere"
    And its first finding names "req:held-by-no-layer" and "anything it `needs`"
