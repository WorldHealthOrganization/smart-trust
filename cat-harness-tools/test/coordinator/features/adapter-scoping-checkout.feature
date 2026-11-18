# Specifies, over the checkout's loaded contributions, the partition between
# built-in content adapters and contributed ones, and that no QA criterion
# depends on a companion its adapters cannot have.
Feature: Built-in and contributed adapters are partitioned, and criteria fit their adapters

  @test:test/coordinator/adapter-scoping-checkout.test.ts::adapter_partition::the_built-in_vocabularies_are_the_platform's_own_—_dak_is_contributed_(bean_1335)
  Scenario: The built-in adapters are the platform's own and dak is contributed
    Given the contributions the checkout loads
    When the built-in content adapters are listed
    Then they are either "paper" alone or "document" and "mathpaper"
    And they do not include "dak"
    And the contributed adapters include "dak"

  @test:test/coordinator/adapter-scoping-checkout.test.ts::adapter_partition::a_contributed_kind_never_overlaps_a_built-in_one
  Scenario: No contributed kind is also a built-in kind
    Given the kinds the checkout's contributions declare
    When each is compared with the built-in block kinds
    Then there is at least one contributed kind
    And none of them is a built-in kind

  @test:test/coordinator/adapter-scoping-checkout.test.ts::criterion_adapter_scope::a_criterion_never_depends_on_a_companion_its_adapters_cannot_have
  Scenario: No criterion depends on a companion its adapters cannot have
    Given every criterion in the QA criteria registry
    When its incompatible companions are computed against the loaded registry
    Then every criterion has none
