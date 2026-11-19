# Specifies that each block kind's RDF class (folioType) is minted in the
# namespace of the instance that declares the kind.
Feature: Block-kind classes live in their declaring instance's namespace

  @test:test/coordinator/block-kind-namespace-checkout.test.ts::block-kind_classes_live_in_their_owner's_namespace::there_are_block_kinds_to_check
  Scenario: There are block kinds to check
    Given the block-kinds directories of every instance in the checkout
    When the kinds with a folioType are collected
    Then there are more than 20

  @test:test/coordinator/block-kind-namespace-checkout.test.ts::block-kind_classes_live_in_their_owner's_namespace::every_folioType's_prefix_is_the_declaring_instance's
  Scenario: Every folioType's prefix is its declaring instance's
    Given the block kinds with a folioType
    When each folioType's prefix is compared with the declaring instance's stub or name
    Then they all match

  @test:test/coordinator/block-kind-namespace-checkout.test.ts::block-kind_classes_live_in_their_owner's_namespace::every_folioType_expands:_its_prefix_is_an_instance_this_checkout_declares
  Scenario: Every folioType expands with the checkout's prefixes
    Given the block kinds with a folioType and the instance prefixes of the checkout
    When a document context is built for each folioType
    Then none throws
