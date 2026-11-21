# Specifies SourceDescriptorSchema (schemas/library/source-descriptor.ts) over
# every source descriptor in the checkout's declared schemas directories.
Feature: Every source descriptor in the checkout parses and explains a non-self-contained subset

  @test:test/coordinator/source-descriptor.test.ts::source_descriptors::there_are_descriptors_to_check,_so_the_checks_below_are_not_vacuous
  Scenario: There are at least two source descriptors
    Given the JSON files in the checkout's declared schemas directories whose $schema is the descriptor tag
    When they are counted
    Then there are at least 2

  @test:test/coordinator/source-descriptor.test.ts::source_descriptors::%s_declares_itself_a_descriptor_and_parses_against_the_schema
  Scenario: Each source descriptor declares itself and parses against the schema
    Given a table with one row per source descriptor file found, by its path relative to the checkout
    When the row's file is read
    Then its $schema is the source descriptor tag
    And it parses against the source descriptor schema with no issue

  @test:test/coordinator/source-descriptor.test.ts::source_descriptors::a_source_whose_subset_is_NOT_self-contained_says_why
  Scenario: A descriptor whose subset is not self-contained gives its basis
    Given every source descriptor
    When each is parsed
    Then each whose subsetIsSelfContained is false has a subsetBasis
