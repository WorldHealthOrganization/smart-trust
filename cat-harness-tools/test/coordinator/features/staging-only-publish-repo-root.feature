# Specifies withheldFromCanonical, isWithheld and compose
# (scripts/compose-docs.ts) and gutsDir, gutsFiles and pageRelPath
# (scripts/gen-fsh-guts-viz.ts) over the checkout, after building the fsh-guts
# page once with fsh-guts:viz.
Feature: The fsh-guts page is published only to staging, and reports undeclared files

  @test:test/coordinator/staging-only-publish-repo-root.test.ts::the_real_declaration_withholds_fsh-guts_and_nothing_else::withholds_exactly_the_fsh-guts_page_directory
  Scenario: The real declaration withholds exactly the fsh-guts page directory
    Given the checkout's declarations
    When the paths withheld from the canonical site are read
    Then they are "cat-harness/fsh-guts/" and "en/cat-harness/fsh-guts/"

  @test:test/coordinator/staging-only-publish-repo-root.test.ts::composing_honours_the_default,_which_is_the_restrictive_one::a_compose_with_NO_options_withholds_—_the_default_is_not_permissive
  Scenario: A compose with no options withholds the page
    Given the checkout
    When the docs are composed with no options
    Then the fsh-guts page is not in the composed tree
    And the report lists it as withheld

  @test:test/coordinator/staging-only-publish-repo-root.test.ts::composing_honours_the_default,_which_is_the_restrictive_one::an_explicit_staging_compose_includes_the_page
  Scenario: A staging compose includes the page
    Given the checkout
    When the docs are composed for staging
    Then the fsh-guts page is in the composed tree
    And nothing is withheld

  @test:test/coordinator/staging-only-publish-repo-root.test.ts::composing_honours_the_default,_which_is_the_restrictive_one::the_two_trees_differ_by_exactly_the_withheld_files
  Scenario: The canonical and staging trees differ by exactly the withheld files
    Given a canonical and a staging compose of the checkout
    When the files each supplied are counted
    Then the staging tree has exactly as many more files as the canonical compose withheld
    And at least one file was withheld
    When the files each supplied are compared by path
    Then every file of the canonical tree is in the staging tree
    And the files only the staging tree has are exactly the files the canonical compose withheld

  @test:test/coordinator/staging-only-publish-repo-root.test.ts::the_fsh-guts_page_reports_the_declaration_gap_rather_than_hiding_it::reads_a_non-empty_corpus
  Scenario: The fsh-guts corpus is not empty
    Given the checkout's fsh-guts directory
    When its files are read
    Then the directory is found
    And there is at least one file

  @test:test/coordinator/staging-only-publish-repo-root.test.ts::the_fsh-guts_page_reports_the_declaration_gap_rather_than_hiding_it::a_file_that_CANNOT_carry_front_matter,_with_a_tagged_sidecar,_is_`sidecar`
  Scenario: Every file declared through a sidecar is not markdown
    Given the files of the fsh-guts directory
    When those in the state "sidecar" are taken
    Then there is at least one
    And none ends with ".md"

  @test:test/coordinator/staging-only-publish-repo-root.test.ts::the_generator_writes_exactly_what_the_withholding_protects::the_written_page_is_covered_by_the_withheld_set
  Scenario: The page the generator writes is covered by the withheld set
    Given the fsh-guts page's relative path
    When it is checked against the withheld set
    Then it is defined
    And it is withheld

  @test:test/coordinator/staging-only-publish-repo-root.test.ts::the_generator_writes_exactly_what_the_withholding_protects::and_it_is_genuinely_absent_from_a_canonical_compose
  Scenario: The page is absent from a canonical compose
    Given the fsh-guts page's relative path
    When the docs are composed with no options
    Then the page is not in the composed tree

  @test:test/coordinator/staging-only-publish-repo-root.test.ts::the_generator_writes_exactly_what_the_withholding_protects::and_present_in_a_staging_compose
  Scenario: The page is present in a staging compose
    Given the fsh-guts page's relative path
    When the docs are composed for staging
    Then the page is in the composed tree
