# Cache scripts keep the built-in cache family names as a fallback when no folio declares a branch prefix;
# this checks each script's fallback list against the known names, newest first.
# Each Scenario names the test that executes it.
Feature: Cache scripts' built-in family name fallbacks

  @test:scripts/tests/cache-family-fallbacks.test.ts::cache_scripts_carry_the_built-in_family_names_newest_first,_and_none_unknown::%s_(%s)::its_fallback_list_is_a_newest-first_prefix_of_the_known_names
  Scenario: A cache script's fallback list is a newest-first prefix of its family's names
    # Skipped: when the script's file is absent from a standalone checkout
    Given the one row fhir-harness/scripts/ig-cache.sh for the "fhir-ast" family
    And the known names "cat/fhir-harness/fhir-ast", "cat-fhir-ast" and "fhir-ast", newest first
    When its single "for p in ...; do" literal is read, dropping trailing slashes
    Then the literal is present
    And it lists at least one name
    And the listed names equal the same number of known names from the start
