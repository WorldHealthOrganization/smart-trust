# scripts/check-declaration-filename.ts finds code, workflow and markdown lines that still name the
# retired "harness.json" declaration, and classifies each. Each Scenario names the test that executes it.
Feature: References to the retired harness.json declaration

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::a_whole-value_string_literal_is_a_bypass
  Scenario: A whole-value string literal naming the file is a bypass
    Given a source file in the owning instance with 'join(root, "harness.json")' on line 1
    When the declaration filename is checked
    Then there is one bypass, of kind "literal", on line 1

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::a_single-quoted_literal_is_the_same_bypass_—_the_repo's_quote_style_is_not_the_rule
  Scenario: A single-quoted literal is the same bypass
    Given a source file in the owning instance joining a single-quoted 'harness.json'
    When the declaration filename is checked
    Then there is one bypass

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::a_map_KEY_is_a_bypass_too_—_it_is_still_the_filename,_not_a_sentence
  Scenario: A map key naming the file is a bypass
    Given a source file in the owning instance calling out.set("harness.json", ...)
    When the declaration filename is checked
    Then there is one bypass

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::an_interpolated_template_builds_a_path,_so_it_is_a_bypass
  Scenario: An interpolated template ending in the filename is a bypass
    Given a source file in the owning instance building "${dir}/harness.json" in a template
    When the declaration filename is checked
    Then there is one bypass, of kind "template"

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::a_message_string_naming_the_retired_file_is_not_a_bypass,_but_it_FAILS_as_user-visible
  Scenario: A message naming the retired file is not a bypass but fails as user-visible
    Given a source file whose console.error message says "no harness.json at ${root}"
    When the declaration filename is checked
    Then there are no bypasses
    And the user-visible findings name "cat-harness/src/a.ts"
    And no prose is counted

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::GUARD:_a_STATIC_path_inside_backticks_is_prose,_not_construction
  Scenario: A static path inside backticks is not construction
    Given a source string mentioning "`cat-harness/harness.json`" with no interpolation
    When the declaration filename is checked
    Then there are no bypasses
    And there is one user-visible finding

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::GUARD:_`docs/_data/harness.json`_is_a_DIFFERENT_FILE_and_must_not_be_reported
  Scenario: The Jekyll data file docs/_data/harness.json is not reported
    Given a source message naming "docs/_data/harness.json"
    When the declaration filename is checked
    Then there are no bypasses and no user-visible findings

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::GUARD:_a_doc_comment_naming_the_file_is_prose
  Scenario: A doc comment naming the file is counted as prose
    Given a source doc comment line "An instance carries `harness.json`."
    When the declaration filename is checked
    Then there are no bypasses and no user-visible findings
    And one line of prose is counted

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::GUARD:_the_CURRENT_declaration_`cat-harness.json`_in_a_message_is_not_the_retired_name
  Scenario: A message naming the current cat-harness.json is not the retired name
    Given a source error message "no cat-harness.json under ${root}"
    When the declaration filename is checked
    Then there are no user-visible findings
    And no prose is counted

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::GUARD:_a_test's_own_message_string_stays_counted_prose,_as_before
  Scenario: A test's own message string is counted prose
    Given a test file expecting a message to contain "no harness.json at"
    When the declaration filename is checked
    Then there are no user-visible findings
    And one line of prose is counted

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::OUTSIDE_the_owning_instance_it_still_fails:_a_message_needs_no_import_to_be_right
  Scenario: A message outside the owning instance still fails as user-visible
    Given a "folio-assistant-core" source file logging "Loaded harness.json"
    When the declaration filename is checked
    Then nothing is counted as cross-instance
    And the user-visible findings name "folio-assistant-core/schemas/a.ts"

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::GUARD:_a_test_fixture_is_counted_and_does_NOT_fail_the_gate
  Scenario: A test fixture writing the file is counted, not failed
    Given a test file writing "harness.json" with writeFileSync
    When the declaration filename is checked
    Then there are no bypasses
    And one test site is counted

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::GUARD:_a_bypass_OUTSIDE_the_owning_instance_is_counted,_not_failed
  Scenario: A bypass outside the owning instance is counted as cross-instance
    Given a "folio-assistant-core" source file joining "harness.json"
    When the declaration filename is checked
    Then there are no bypasses
    And there is one cross-instance site, in "folio-assistant-core/schemas/a.ts"

  @test:scripts/tests/check-declaration-filename.test.ts::a_path_to_the_declaration_is_built_from_the_constant::examining_nothing_is_not_a_pass
  Scenario: An empty tree reads no files
    # Gap: only the zero file count is checked; the runner's non-zero exit is not exercised
    Given an empty directory
    When the declaration filename is checked
    Then the number of files read is 0

  @test:scripts/tests/check-declaration-filename.test.ts::a_workflow_line_is_classified,_not_merely_counted::a_step_that_READS_the_retired_declaration_fails
  Scenario: A workflow step reading the retired declaration is a use
    Given the workflow line "run: cat cat-harness/harness.json"
    When it is classified
    Then it is "use"

  @test:scripts/tests/check-declaration-filename.test.ts::a_workflow_line_is_classified,_not_merely_counted::a_comment_naming_it_is_prose_—_a_rename_REWORDS_these
  Scenario: A workflow comment naming the file is prose
    Given two workflow comment lines naming "harness.json"
    When they are classified
    Then each is "prose"

  @test:scripts/tests/check-declaration-filename.test.ts::a_workflow_line_is_classified,_not_merely_counted::the_Jekyll_data_file_is_its_own_class,_and_outranks_prose
  Scenario: The Jekyll data file in a workflow is its own class
    Given a workflow comment and a run step each naming "docs/_data/harness.json"
    When they are classified
    Then each is "jekyll-data"

  @test:scripts/tests/check-declaration-filename.test.ts::a_workflow_line_is_classified,_not_merely_counted::a_line_not_naming_it_at_all_classifies_as_null,_not_as_clean
  Scenario: A workflow line not naming the file classifies as null
    Given the workflow line "- name: Checkout"
    When it is classified
    Then the class is null

  @test:scripts/tests/check-declaration-filename.test.ts::GUARD:_`cat-harness.json`_CONTAINS_`harness.json`::the_CURRENT_declaration_is_not_a_reference_to_the_retired_one
  Scenario: The current cat-harness.json in a workflow is not the retired name
    Given a workflow comment and a run step naming "cat-harness/cat-harness.json"
    When they are classified
    Then each classifies as null

  @test:scripts/tests/check-declaration-filename.test.ts::GUARD:_`cat-harness.json`_CONTAINS_`harness.json`::...and_the_boundary_does_not_swallow_the_real_thing
  Scenario: The retired name is still matched next to the cat-harness.json boundary
    Given the run steps "cat cat-harness/harness.json" and "cat harness.json"
    When they are classified
    Then each is "use"

  @test:scripts/tests/check-declaration-filename.test.ts::GUARD:_`cat-harness.json`_CONTAINS_`harness.json`::a_second_occurrence_in_an_already-seen_file_is_its_own_finding
  Scenario: Each workflow line naming the retired file is classified on its own
    # Gap: classifies two separate lines; does not check that a second occurrence in one file is counted as a separate finding
    Given run steps reading "cat-harness/harness.json" and "folio-assistant/harness.json"
    When each is classified
    Then both are "use"

  @test:scripts/tests/check-declaration-filename.test.ts::the_workflow_scan_reports_unknown,_never_zero::a_checkout_with_no_.github/workflows_gives_null,_and_null_is_not_clean
  Scenario: A checkout with no workflows reports the workflow scan as null
    Given a checkout with one source file and no .github/workflows
    When the declaration filename is checked
    Then the workflow result is null
    And the workflow uses derived from it are an empty list

  @test:scripts/tests/check-declaration-filename.test.ts::the_workflow_scan_reports_unknown,_never_zero::this_repository's_own_workflows_carry_no_USE
  Scenario: This repository's workflows carry no use of the retired file
    Given this repository's real corpus
    When its workflow uses are listed
    Then there are none

  @test:scripts/tests/check-declaration-filename.test.ts::markdown_lines_are_classified,_not_matched::a_current-path_claim_in_a_skill_FAILS
  Scenario: A current-path claim in a skill is a use
    Given the skill line "declared in `harness.json` at the root"
    When it is classified as markdown
    Then it is "use"

  @test:scripts/tests/check-declaration-filename.test.ts::markdown_lines_are_classified,_not_matched::a_line_naming_no_declaration_is_not_a_finding_at_all
  Scenario: A markdown line naming no declaration is not a finding
    Given the skill line "nothing to see here"
    When it is classified as markdown
    Then the class is null

  @test:scripts/tests/check-declaration-filename.test.ts::markdown_lines_are_classified,_not_matched::`docs/_data/harness.json`_is_Jekyll's_and_must_NOT_be_renamed
  Scenario: The Jekyll data file in markdown is its own class
    Given a docs line naming "docs/_data/harness.json"
    When it is classified as markdown
    Then it is "jekyll-data"

  @test:scripts/tests/check-declaration-filename.test.ts::markdown_lines_are_classified,_not_matched::a_declared_record_directory_is_correct_history
  Scenario: A line in a declared record directory is a record
    Given the line "we used `harness.json`" in "beans/defs/x.md" with "beans/" as a record directory
    When it is classified as markdown
    Then it is "record"

  @test:scripts/tests/check-declaration-filename.test.ts::markdown_lines_are_classified,_not_matched::a_generated_reference_follows_its_source_rather_than_failing
  Scenario: A line in a generated reference is classed as generated
    Given the line "`harness.json`" in a file under the generated prefix "cat-harness/docs/reference/skill-instructions/"
    When it is classified as markdown
    Then it is "generated"

  @test:scripts/tests/check-declaration-filename.test.ts::markdown_lines_are_classified,_not_matched::history_is_recognised_by_a_CURRENT_name_in_the_paragraph,_not_by_tense
  Scenario: A paragraph that also names the current name makes the line historical
    Given a paragraph saying "It is `<name>.json` now." before the line naming "harness.json"
    When the line is classified as markdown
    Then it is "historical"

  @test:scripts/tests/check-declaration-filename.test.ts::markdown_lines_are_classified,_not_matched::...and_a_paragraph_naming_ONLY_the_retired_word_cannot_excuse_itself
  Scenario: A paragraph naming only the retired file does not excuse the line
    Given a paragraph whose two lines both name only "harness.json"
    When the second line is classified as markdown
    Then it is "use"

  @test:scripts/tests/check-declaration-filename.test.ts::markdown_lines_are_classified,_not_matched::a_concrete_sibling_declaration_counts_as_the_current_name
  Scenario: A concrete sibling declaration counts as the current name
    Given the line "`cat-harness/cat-harness.json` replaced `harness.json`." as its own paragraph
    When it is classified as markdown
    Then it is "historical"

  @test:scripts/tests/check-declaration-filename.test.ts::the_retired_name_is_matched_as_a_FILENAME,_on_both_sides::a_published_rendering_is_not_the_retired_declaration
  Scenario: A harness.jsonld rendering is not the retired declaration
    Given the skill line naming "…/folio-assistant/harness.jsonld"
    When it is classified as markdown
    Then the class is null

  @test:scripts/tests/check-declaration-filename.test.ts::the_retired_name_is_matched_as_a_FILENAME,_on_both_sides::the_CURRENT_declaration_is_not_the_retired_one_either
  Scenario: The current cat-harness.json in markdown is not the retired declaration
    Given the skill line "open `cat-harness/cat-harness.json` first"
    When it is classified as markdown
    Then the class is null

  @test:scripts/tests/check-declaration-filename.test.ts::the_retired_name_is_matched_as_a_FILENAME,_on_both_sides::...but_the_retired_name_itself_still_matches,_bounded_either_side
  Scenario: The retired filename still matches with a filename boundary on either side
    Given the skill lines "open `harness.json` first" and "open `cat-harness/harness.json` first"
    When they are classified as markdown
    Then each is "use"

  @test:scripts/tests/check-declaration-filename.test.ts::the_TypeScript_corpus,_on_this_repository::carries_no_user-visible_string_naming_the_retired_declaration
  Scenario: This repository's TypeScript has no user-visible string naming the retired file
    Given this repository's real corpus
    When the declaration filename is checked
    Then there are no user-visible findings

  @test:scripts/tests/check-declaration-filename.test.ts::the_markdown_corpus,_on_this_repository::carries_no_STALE_PATH
  Scenario: This repository's markdown has no stale path to the retired file
    Given this repository's real corpus
    When its markdown uses are listed
    Then there are none

  @test:scripts/tests/check-declaration-filename.test.ts::the_markdown_corpus,_on_this_repository::and_was_actually_examined_—_an_empty_corpus_is_not_a_pass
  Scenario: This repository's markdown corpus was examined
    Given this repository's real corpus
    When the declaration filename is checked
    Then the markdown result is not null
    And it holds more than zero entries

  @test:scripts/tests/check-declaration-filename.test.ts::a_line's_paragraph_is_found_in_linear_time::every_non-blank_line_gets_the_paragraph_the_walk_gave_it
  Scenario: Each non-blank line's paragraph matches the old walk
    Given lines with single and repeated blank lines and a whitespace-only line
    When the paragraphs of the lines are indexed
    Then every non-blank line gets the same paragraph the line-by-line walk returns

  @test:scripts/tests/check-declaration-filename.test.ts::a_line's_paragraph_is_found_in_linear_time::a_file_with_no_blank_line_at_all_is_one_paragraph
  Scenario: A file without blank lines is one paragraph
    Given the lines "x", "y" and "z"
    When the paragraph of the middle line is asked for
    Then it is all three lines joined by newlines

  @test:scripts/tests/check-declaration-filename.test.ts::a_line's_paragraph_is_found_in_linear_time::a_20,000-line_block_with_the_retired_name_on_every_line_scans_in_well_under_a_second
  Scenario: Paragraph lookup over 20,000 lines finishes within a second
    # Gap: only the paragraph index is timed, not the full declaration-filename scan
    Given a 20,000-line block naming "harness.json" on every line with no blank line
    When the paragraph of every line is asked for
    Then indexing and all lookups together take under 1000 ms
