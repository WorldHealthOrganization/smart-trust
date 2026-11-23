# The site root is one answer: siteDir and siteDirFor in schemas/kg/cat-harness.ts give it, and no source file under scripts, content, schemas, src or test hardcodes the output site root in a path-resolving position.
# Each Scenario names the test that executes it.
Feature: The site root is one answer, not a literal

  @test:scripts/tests/ui/site-dir-single-answer.test.ts::the_site_root_is_one_answer,_not_a_literal::siteDir_is_docs_under_the_layer_root_whatever_the_stub,_and_siteDirFor_reads_this_instance's
  Scenario: siteDir and siteDirFor give "docs" for every layer
    Given an instance declaration with name "x" and stub "y", one with name "x" only, and this harness root
    When the site directory is asked of each
    Then every answer is "docs"

  @test:scripts/tests/ui/site-dir-single-answer.test.ts::the_site_root_is_one_answer,_not_a_literal::an_instance_with_no_name_or_stub_cannot_get_a_guessed_site_root
  Scenario: A directory that is not an instance gets no guessed site root
    Given the tools layer's scripts directory, which is no instance root
    When its site directory is asked for
    Then it throws "cannot determine the site root"

  @test:scripts/tests/ui/site-dir-single-answer.test.ts::the_site_root_is_one_answer,_not_a_literal::no_source_file_hardcodes_the_output_site_root
  Scenario: No source file hardcodes the output site root
    Given every .ts and .mjs file under scripts, content, schemas, src and test, committed or not, with comments blanked
    When each line is scanned for a docs literal in a path-resolving call or a cwd, dir, root or base property
    And lines naming the content docs input are excused
    Then no line is reported
