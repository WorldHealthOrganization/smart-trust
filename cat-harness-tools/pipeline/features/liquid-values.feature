# pipeline/liquid-values.ts resolves Liquid value references such as {{ demo.version }} once,
# the same way for the PDF and the site. Each Scenario names the test that executes it.
Feature: Liquid value references

  @test:pipeline/liquid-values.test.ts::addressing::a_witness_under_a_DECLARED_directory_resolves,_with_provenance
  Scenario: A witness under a declared directory resolves with provenance
    Given a folio "demo" declaring a computations directory holding codata-masses.witness.json
    When the key "demo.computations.codata-masses.data.m_e_MeV" is resolved
    Then it is resolved to "0.51099895069"
    And its provenance names the file "demo/computations/codata-masses.witness.json", the path "data.m_e_MeV", commit "abc123" and script hash "def456"

  @test:pipeline/liquid-values.test.ts::addressing::a_declaration_scalar_resolves:_{{_demo.version_}}
  Scenario: A declaration scalar resolves
    Given the folio "demo" declares version "1.2.3"
    When the key "demo.version" is resolved
    Then it is resolved to "1.2.3"

  @test:pipeline/liquid-values.test.ts::addressing::an_UNDECLARED_directory_is_not_addressable,_even_though_the_file_exists
  Scenario: A witness in an undeclared directory is not addressable
    Given demo has a stray directory, not declared, holding x.witness.json
    When the key "demo.stray.x.data.v" is resolved
    Then it is unresolved

  @test:pipeline/liquid-values.test.ts::addressing::a_pass-through_prefix_and_a_foreign_one_are_left_for_Jekyll
  Scenario: A pass-through prefix and a foreign one are left for Jekyll
    Given a layer "ig" declaring the Liquid prefix "site.data" as pass-through
    When "site.data.fhir.ig.version" is resolved
    Then its state is "pass-through"
    And "page.title" is "not-ours"

  @test:pipeline/liquid-values.test.ts::substitution::precision_is_significant_digits;_no_filter_prints_the_stored_value
  Scenario: Precision rounds to significant digits and no filter prints the stored value
    Given text referencing the electron mass once with "precision: 4" and once with no filter
    When the Liquid values are substituted
    Then the text reads "a 0.5110 b 0.51099895069"

  @test:pipeline/liquid-values.test.ts::substitution::site.data_and_page.*_survive_untouched_for_Jekyll_/_the_IG_Publisher
  Scenario: site.data and page references survive untouched
    Given text referencing "site.data.fhir.ig.version" and "page.title"
    When the Liquid values are substituted
    Then the text is unchanged

  @test:pipeline/liquid-values.test.ts::substitution::an_unresolved_own_reference_is_VISIBLE_and_reported,_never_an_empty_string
  Scenario: An unresolved own reference is visible in the text and reported
    Given text referencing "demo.computations.nope.data.v"
    When the Liquid values are substituted
    Then the text reads "x ⟦unresolved: demo.computations.nope.data.v⟧ y"
    And the report lists that key as unresolved

  @test:pipeline/liquid-values.test.ts::substitution::an_unknown_filter_is_reported,_not_ignored
  Scenario: An unknown filter is reported
    Given the reference "demo.version" with the filter "round: 2"
    When the Liquid values are substituted
    Then the first unresolved reason contains "unknown filter"

  @test:pipeline/liquid-values.test.ts::one_value,_every_target::the_PDF_path_and_the_site_path_print_the_same_number,_in_prose_and_in_math
  Scenario: The PDF path and the site path print the same number in prose and in math
    Given markdown referencing the electron mass with "precision: 6" in prose and inside math
    When it is rendered to LaTeX and to site HTML
    Then each output contains "0.510999" twice
    And neither output contains "{{"
