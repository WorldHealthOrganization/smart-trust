# Specifies COVERED (scripts/pair-cover.ts) against the pairs regen asks,
# derived from the checkout's workflows through loadGates and
# repairableGates.
Feature: Every folded pair and its coverers are pairs regen asks, and every residual is a script

  @test:test/coordinator/pair-cover-workflows.test.ts::the_equivalences_still_hold_in_this_tree::every_residual_is_a_script,_and_every_coverer_a_pair_regen_asks
  Scenario: Every folded check and coverer is asked, and every residual exists
    Given the pairs regen asks, derived from the checkout's fast gates
    When each entry of the covered table is read
    Then its check is an asked pair
    And each of its coverers is an asked pair
    And its residual, where it has one, is a script in the checkout
