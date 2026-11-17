# declaresGenerated in scripts/check-reference-direction.ts decides whether a file declares itself generator output and so exempts itself from the reference-direction check.
# Each Scenario names the test that executes it.
Feature: A file declaring itself generated

  @test:schemas/reference-direction-declaration.test.ts::JSON_declares_itself_by_a_top-level_`_generated`,_in_any_position::first_key,_as_`sync-docs-harness.ts`_has_always_emitted_it
  Scenario: A JSON file with "_generated" as its first key declares itself generated
    Given a JSON file whose first key is "_generated"
    When it is asked whether it declares itself generated
    Then it does

  @test:schemas/reference-direction-declaration.test.ts::JSON_declares_itself_by_a_top-level_`_generated`,_in_any_position::after_`$schema`_—_the_case_the_old_first-key_regex_refused
  Scenario: A JSON file with "_generated" after "$schema" declares itself generated
    Given a JSON file whose keys are "$schema", then "_generated", then others
    When it is asked whether it declares itself generated
    Then it does

  @test:schemas/reference-direction-declaration.test.ts::JSON_declares_itself_by_a_top-level_`_generated`,_in_any_position::after_`@context`_in_JSON-LD,_which_a_reader_needs_first
  Scenario: A JSON-LD file with "_generated" after "@context" declares itself generated
    Given a ".jsonld" file whose keys are "@context", then "_generated", then "@graph"
    When it is asked whether it declares itself generated
    Then it does

  @test:schemas/reference-direction-declaration.test.ts::JSON_declares_itself_by_a_top-level_`_generated`,_in_any_position::last,_after_a_long_array_—_position_is_not_part_of_the_contract
  Scenario: A JSON file with "_generated" last, after a long array, declares itself generated
    Given a JSON file whose "_generated" key comes after a 500-item array
    Then the key starts more than 2000 characters into the file
    And the file declares itself generated

  @test:schemas/reference-direction-declaration.test.ts::what_does_NOT_count::`_generated`_nested_deeper_is_what_the_file_MENTIONS,_not_what_it_IS
  Scenario: A "_generated" key nested below the top level does not count
    Given a JSON file with "_generated" only inside a nested object and an array item
    When it is asked whether it declares itself generated
    Then it does not

  @test:schemas/reference-direction-declaration.test.ts::what_does_NOT_count::a_JSON_array_has_no_top_level_to_declare_on
  Scenario: A JSON array does not declare itself generated
    Given a JSON file whose top level is an array of objects carrying "_generated"
    When it is asked whether it declares itself generated
    Then it does not

  @test:schemas/reference-direction-declaration.test.ts::what_does_NOT_count::unparseable_JSON_is_not_a_licence_to_skip_it
  Scenario: Unparseable JSON does not declare itself generated
    Given a JSON file that is truncated after its "_generated" value
    When it is asked whether it declares itself generated
    Then it does not

  @test:schemas/reference-direction-declaration.test.ts::what_does_NOT_count::a_Markdown_page_that_DISCUSSES_generation_does_not_exempt_itself
  Scenario: A Markdown page that only discusses generation does not declare itself generated
    Given a Markdown page whose front matter has no "generated" key
    And whose body has a line starting "generated: scripts/x.ts"
    When it is asked whether it declares itself generated
    Then it does not

  @test:schemas/reference-direction-declaration.test.ts::what_does_NOT_count::a_Markdown_page_with_no_front_matter_at_all
  Scenario: A Markdown page with no front matter does not declare itself generated
    Given a Markdown page holding only the line "generated: scripts/x.ts"
    When it is asked whether it declares itself generated
    Then it does not

  @test:schemas/reference-direction-declaration.test.ts::what_does_NOT_count::a_file_that_is_not_there
  Scenario: A file that does not exist does not declare itself generated
    Given a path to a JSON file that does not exist
    When it is asked whether it declares itself generated
    Then it does not

  @test:schemas/reference-direction-declaration.test.ts::Markdown_keeps_the_front-matter_route_unchanged::a_`generated:`_key_in_the_front_matter,_as_the_docs_mirrors_carry_it
  Scenario: A Markdown page with a "generated:" key in its front matter declares itself generated
    Given a Markdown page whose front matter carries "generated: scripts/gen-skill-docs.ts — do not hand-edit"
    When it is asked whether it declares itself generated
    Then it does
