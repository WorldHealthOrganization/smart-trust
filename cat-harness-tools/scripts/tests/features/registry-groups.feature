# Every class the graph exporter can mint from REGISTRY_GROUPS is one the
# vocabulary defines (bean 3190), and the source scan cannot see those
# classes, which is why ns-export unions the two. Each Scenario names the test
# that executes it.
Feature: Every minted class is a defined class

  @test:scripts/tests/registry-groups.test.ts::a_minted_class_is_a_defined_class::every_REGISTRY_GROUPS_class_has_a_vocabulary_gloss
  Scenario: Every registry class has a vocabulary gloss
    Then no class in REGISTRY_GROUPS lacks a class gloss

  @test:scripts/tests/registry-groups.test.ts::a_minted_class_is_a_defined_class::the_table_is_not_empty_—_a_vacuous_pass_would_satisfy_the_above
  Scenario: The registry table is not empty
    Then REGISTRY_GROUPS has at least 5 entries
    And one of its classes is "Convention"

  @test:scripts/tests/registry-groups.test.ts::a_minted_class_is_a_defined_class::keys_are_directories,_values_are_classes_—_and_they_differ
  Scenario: Keys are directories and values are classes
    Then every key differs from its value, starts lowercase, and its value starts uppercase

  @test:scripts/tests/registry-groups.test.ts::the_source_scan_cannot_see_these,_which_is_why_the_union_exists::a_registry-minted_class_appears_in_NO_`termIri`_literal
  Scenario: A registry-minted class is not in any termIri literal
    When the source is scanned for minted terms
    Then "Convention" and "Requirement" are not among them

  @test:scripts/tests/registry-groups.test.ts::the_source_scan_cannot_see_these,_which_is_why_the_union_exists::...while_the_scan_is_still_finding_real_terms
  Scenario: The source scan still finds real terms
    When the source is scanned for minted terms
    Then more than 20 are found
