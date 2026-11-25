# `sidecarRootFor` in `scripts/check-l1-complete.ts` writes an L1 verdict under the
# layer that owns the library entry and holds a qa tree, never an undeclared root.
# Each Scenario names the test that executes it.
Feature: L1 sidecar owner

  @test:scripts/tests/l1-sidecar-owner.test.ts::an_entry's_sidecar_root_is_the_instance_holding_its_library,_not_an_undeclared_checkout_root
  Scenario: An entry's sidecar root is the instance holding its library
    Given an undeclared checkout root holding an instance "inst" that declares a library with "some-entry" and a qa directory
    When the sidecar root is found for "some-entry" from the instance and from the checkout root
    Then both answers are the instance
    And for "not-an-entry" from the checkout root the answer is the checkout root

  @test:scripts/tests/l1-sidecar-owner.test.ts::an_owner_with_no_qa_tree_does_not_get_the_sidecar
  Scenario: An owner with no qa tree does not get the sidecar
    # Gap: asked from the instance itself the answer is still the instance; only the checkout-root case falls back
    Given an undeclared checkout root holding an instance "inst" that declares a library with "some-entry" and no qa directory
    When the sidecar root is found for "some-entry"
    Then from the instance the answer is the instance
    And from the checkout root the answer is the harness root
