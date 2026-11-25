# Specifies the "cat-harness:instances" README section and isForeignRoot
# (pipeline/readme-sections.ts) over the checkout.
Feature: The instances README table links only what exists, and a mounted layer's README is foreign

  @test:test/coordinator/readme-sections-checkout.test.ts::cat-harness:instances_—_both_entries,_per_instance_(issue_#592)::every_relative_link_in_the_table_resolves_in_the_checkout
  Scenario: Every relative link in the instances table resolves in the checkout
    Given the "cat-harness:instances" section rendered for the checkout without fetching
    When its relative links are collected
    Then there is at least one
    And every one exists in the checkout
    And it links "[memory](./cat-harness/memory/)"

  @test:test/coordinator/readme-sections-checkout.test.ts::isForeignRoot_—_`--all`_skips_a_README_another_repository_owns_(bean_kye5)::this_checkout's_bootstrap-tools_is_one_—_a_remote_mount_since_bean_nn8e,_a_submodule_before_(the_case_the_skip_exists_for)
  Scenario: The checkout's bootstrap-tools is a foreign root
    Given the checkout's bootstrap-tools directory
    When it is asked whether it is a foreign root
    Then it is
