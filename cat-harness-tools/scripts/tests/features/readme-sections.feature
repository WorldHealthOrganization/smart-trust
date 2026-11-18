# readme_sync: the generated-section registry. Nothing outside a region the
# README marks with <!-- name:begin --> / <!-- name:end --> is ever written.
# The fixture is a folio layer "fixture" with one paper "solo". Each Scenario
# names the test that executes it.
Feature: Generated README sections are written only inside their markers

  @test:scripts/tests/readme-sections.test.ts::nothing_outside_a_marked_region_is_ever_written::prose_above_and_below_a_marker_survives_verbatim
  Scenario: Prose above and below a marker survives
    Given a README with a title, prose, an empty workflows region and more prose
    When the sections are synced
    Then the title and both prose lines are still there

  @test:scripts/tests/readme-sections.test.ts::nothing_outside_a_marked_region_is_ever_written::a_README_with_no_markers_is_left_byte-identical
  Scenario: A README with no markers is left byte-identical
    Given a README with no markers
    When the sections are synced
    Then its text is unchanged, nothing is written and nothing changed

  @test:scripts/tests/readme-sections.test.ts::nothing_outside_a_marked_region_is_ever_written::registered_sections_the_README_omits_are_absent,_not_errors
  Scenario: Registered sections the README omits are absent, not errors
    Given a README with only a "folio:toc" region
    When the sections are synced
    Then only "folio:toc" is written
    And "folio:workflows" and "folio:lean-modules" are reported absent

  @test:scripts/tests/readme-sections.test.ts::nothing_outside_a_marked_region_is_ever_written::runReadmeSync_writes_nothing_and_explains_itself_when_no_marker_exists
  Scenario: The sync writes nothing and explains itself when there is no marker
    Given a README with no markers
    When the README sync runs
    Then it exits 0 saying the README "carries no generated-section markers"
    And the README is unchanged

  @test:scripts/tests/readme-sections.test.ts::workflows_section::descriptions_come_from_each_workflow's_own_name:
  Scenario: Workflow descriptions come from each workflow's name
    Given workflows build.yml named "Build and Publish" and lint.yaml named "Lint" in quotes
    When the workflows section is rendered
    Then it has the rows "| `build.yml` | Build and Publish |" and "| `lint.yaml` | Lint |"

  @test:scripts/tests/readme-sections.test.ts::workflows_section::a_workflow_with_no_name:_is_listed_with_a_blank_cell_and_a_note
  Scenario: A workflow with no name is listed blank with a note
    Given a workflow nameless.yml with no name
    When the workflows section is rendered
    Then it has the row "| `nameless.yml` |  |"
    And a note says "no `name:` field"

  @test:scripts/tests/readme-sections.test.ts::workflows_section::no_workflows_directory_renders_a_sentence,_not_an_empty_table
  Scenario: No workflows directory renders a sentence
    When the workflows section is rendered for a folio with no workflows
    Then there is no "| Workflow |" table and it contains "_No"

  @test:scripts/tests/readme-sections.test.ts::lean_modules_section::the_namespace_is_the_folio's_own_Lake_library,_not_a_hardcoded_one
  Scenario: The Lean namespace is the folio's own Lake library
    Given the paper's lakefile declares lean_lib "Solo" and holds Solo/Basic.lean
    Then the Lean library name of "solo" is "Solo"
    And the Lean modules section lists "`Solo.Basic`" and nothing under "QOU."

  @test:scripts/tests/readme-sections.test.ts::lean_modules_section::no_lean_lib_means_unprefixed_modules_and_a_note_—_never_an_invented_namespace
  Scenario: No lean_lib means unprefixed modules and a note
    Given the paper holds lean/Basic.lean with no lakefile
    When the Lean modules section is rendered
    Then it lists "| `Basic` |"
    And a note says "no [[lean_lib]]"

  @test:scripts/tests/readme-sections.test.ts::lean_modules_section::a_folio_with_no_Lean_at_all_renders_a_sentence
  Scenario: A folio with no Lean renders a sentence
    When the Lean modules section is rendered for a folio with no Lean
    Then it says "_No papers with Lean sources"

  @test:scripts/tests/readme-sections.test.ts::simulators_section::a_configured_directory_that_is_absent_here_is_left_unchanged,_not_blanked
  Scenario: A configured simulators directory that is absent leaves the section unchanged
    Given the config names simulators directory "not-checked-out", which does not exist, and the README's simulators region holds a "Kept" row
    When the simulators section is rendered
    Then it is skipped
    When the README sync runs
    Then it exits 0 saying "left unchanged" and the "Kept" row is still there

  @test:scripts/tests/readme-sections.test.ts::simulators_section::a_directory_that_exists_but_holds_nothing_is_a_determined_empty
  Scenario: An existing but empty simulators directory is a determined empty
    Given the config names simulators directory "sims", which exists and is empty
    When the simulators section is rendered
    Then it is not skipped and says "_No simulators"

  @test:scripts/tests/readme-sections.test.ts::simulators_section::the_directory_comes_from_harness.config.json,_not_a_fixed_path
  Scenario: The simulators directory comes from the config
    Given the config names simulators directory "sims" holding bring_surface.html
    When the simulators section is rendered
    Then it lists "Bring Surface" linking "(sims/bring_surface.html)"

  @test:scripts/tests/readme-sections.test.ts::runReadmeSync::--check_reports_staleness_without_writing,_then_a_run_fixes_it
  Scenario: --check reports staleness without writing, and a run fixes it
    Given a workflow ci.yml named "CI" and a README with an empty workflows region
    When the README sync runs with --check
    Then it exits 1 and the README does not list ci.yml
    When the README sync runs
    Then it exits 0 and the README lists "| `ci.yml` | CI |"
    And --check then exits 0 and another run says "already current"

  @test:scripts/tests/readme-sections.test.ts::runReadmeSync::an_unknown_--only_section_is_refused_by_name
  Scenario: An unknown --only section is refused by name
    When the README sync runs with --only "folio:nope"
    Then it exits 2 saying "Unknown section(s): folio:nope"

  @test:scripts/tests/readme-sections.test.ts::runReadmeSync::--only_leaves_the_other_marked_sections_alone
  Scenario: --only leaves the other marked sections alone
    Given a README with empty toc and workflows regions, and a workflow ci.yml
    When the README sync runs with --only "folio:workflows"
    Then the README lists ci.yml and the toc region is still empty

  @test:scripts/tests/readme-sections.test.ts::runReadmeSync::a_missing_README_is_an_error,_not_a_silently_created_file
  Scenario: A missing README is an error
    When the README sync runs in a folio with no README
    Then it exits 2

  @test:scripts/tests/readme-sections.test.ts::cat-harness:instances_—_both_entries,_per_instance_(issue_#592)::renders_a_row_for_every_instance_that_declares_a_harness.json
  Scenario: The instances section has a row per declared instance
    When the "cat-harness:instances" section is rendered for this repository
    Then it has one row per instance root, and there is more than one

  @test:scripts/tests/readme-sections.test.ts::cat-harness:instances_—_both_entries,_per_instance_(issue_#592)::indexes_the_instances_INSIDE_this_repository,_not_the_directory_holding_it
  Scenario: The instances section indexes the instances inside this repository
    When the "cat-harness:instances" section is rendered for this repository
    Then it has rows for "cat-harness" and "bootstrap"

  @test:scripts/tests/readme-sections.test.ts::cat-harness:instances_—_both_entries,_per_instance_(issue_#592)::an_instance_with_no_agent_entry_gets_an_em_dash,_never_a_guessed_path
  Scenario: An instance with no agent entry gets an em dash
    Given a repository whose instance "mute" declares only a README asset
    When the instances section is rendered
    Then mute's row holds "| — |" and does not name "mute/AGENTS.md"

  @test:scripts/tests/readme-sections.test.ts::cat-harness:instances_—_both_entries,_per_instance_(issue_#592)::a_docs_directory_built_at_publish_is_not_linked,_whether_or_not_a_writer_has_run
  Scenario: A docs directory built at publish is not linked
    Given an instance "built" whose docs/ directory is built at publish
    When the instances section is rendered before and after docs/ is created
    Then the two renderings are identical
    And neither links "built/docs/", and it says "built at publish, never committed"

  @test:scripts/tests/readme-sections.test.ts::cat-harness:instances_—_both_entries,_per_instance_(issue_#592)::states_the_gap_as_a_count_AND_says_which_check_names_them
  Scenario: The gap is stated as a count with the check that names it
    Given a repository whose instance "mute" has no agent entry
    When the instances section is rendered
    Then it says "**N of M** declare no `agent-instructions`" and names "check:subgraph-coverage"

  @test:scripts/tests/readme-sections.test.ts::cat-harness:instances_—_both_entries,_per_instance_(issue_#592)::every_instance_in_THIS_repository_now_carries_both_entries
  Scenario: Every instance of this repository carries both entries
    When the instances section is rendered for this repository
    Then every row names "AGENTS.md"
    And no gap is stated

  @test:scripts/tests/readme-sections.test.ts::cat-harness:instances_—_both_entries,_per_instance_(issue_#592)::carries_each_role's_purpose_from_the_one_place_it_is_declared
  Scenario: Each role's purpose comes from where it is declared
    When the instances section is rendered for this repository
    Then it contains the declared purposes of the agent-instructions and instance-readme roles

  @test:scripts/tests/readme-sections.test.ts::cat-harness:instances_—_both_entries,_per_instance_(issue_#592)::an_unreadable_tree_is_UNDETERMINED,_not_'this_repository_has_no_instances'
  Scenario: A tree with no instances is undetermined
    When the instances section is rendered for an empty directory
    Then it is skipped with empty markdown

  @test:scripts/tests/readme-sections.test.ts::readme:toc_—_the_README's_own_h2/h3_outline::GitHub's_slug_rule:_lowercase,_punctuation_dropped,_each_space_a_hyphen
  Scenario: GitHub's slug rule
    Then "Getting Started" slugs to "getting-started" and "What's new?" to "whats-new"
    And "A & B" slugs to "a--b"
    And "snake_case and kebab-case" keeps the underscore and hyphen
    And "Überblick 2" slugs to "überblick-2"

  @test:scripts/tests/readme-sections.test.ts::readme:toc_—_the_README's_own_h2/h3_outline::inline_markup_is_stripped_before_slugging,_as_GitHub_renders_it
  Scenario: Inline markup is stripped before slugging
    When headings with code, a link, bold and italic are extracted
    Then their texts are "bun run cat gates — the one to run" and "Docs and bold it"
    And their anchors are "bun-run-cat-gates--the-one-to-run" and "docs-and-bold-it"

  @test:scripts/tests/readme-sections.test.ts::readme:toc_—_the_README's_own_h2/h3_outline::duplicates_get_-1,_-2_across_ALL_levels,_and_a_literal_`x-1`_is_bumped_past
  Scenario: Duplicate anchors are numbered across all levels
    When "# Setup", "## Setup", "### Setup" and "## Setup-1" are extracted
    Then the anchors are "setup", "setup-1", "setup-2" and "setup-1-1"

  @test:scripts/tests/readme-sections.test.ts::readme:toc_—_the_README's_own_h2/h3_outline::headings_inside_code_fences_and_HTML_comments_are_not_headings
  Scenario: Headings inside code fences and HTML comments are not headings
    Given headings inside backtick and tilde fences, an HTML comment, and indented code, between "## Real" and "## Also real"
    When the headings are extracted
    Then they are "Real" and "Also real"

  @test:scripts/tests/readme-sections.test.ts::readme:toc_—_the_README's_own_h2/h3_outline::a_setext_heading_counts;_a_`---`_after_a_list_or_a_blank_line_does_not
  Scenario: A setext heading counts, a rule after a list or blank line does not
    When "Intro" underlined with dashes, a list followed by "---", and a lone "---" are extracted
    Then there is one heading: level 2 "Intro", anchor "intro", line 1

  @test:scripts/tests/readme-sections.test.ts::readme:toc_—_the_README's_own_h2/h3_outline::h2/h3_only,_nested,_h1_left_out;_the_TOC's_own_region_is_not_an_input
  Scenario: The README TOC lists nested h2 and h3 only and ignores its own region
    Given a README with a title, an empty TOC region, h2 "One", h3 "One a", h4 "deep" and h2 "Two [x]"
    When the sections are synced
    Then only the TOC is written, nesting One, One a, and an escaped "Two \[x\]"
    And it lists neither the title nor "deep"
    And a second sync changes nothing

  @test:scripts/tests/readme-sections.test.ts::readme:toc_—_the_README's_own_h2/h3_outline::headings_a_section_registered_earlier_generates_are_in_the_outline_on_the_same_run
  Scenario: Headings generated by an earlier section are in the outline on the same run
    Given a README with a TOC region, "## Contents" and a "folio:toc" region
    When the sections are synced
    Then the TOC lists Contents with "Solo" nested under it
    And a second sync changes nothing

  @test:scripts/tests/readme-sections.test.ts::readme:toc_—_the_README's_own_h2/h3_outline::no_h2/h3_is_a_determined_empty;_no_README_text_is_undetermined
  Scenario: No h2 or h3 is a determined empty, and no README text is undetermined
    Then the TOC rendered for a README holding only a title says "no sections"
    And the TOC rendered with no README text is skipped

  @test:scripts/tests/readme-sections.test.ts::readme:toc_—_the_README's_own_h2/h3_outline::it_is_registered_last,_so_it_sees_every_other_section's_output
  Scenario: The README TOC is registered last
    Then the last registered section is the README TOC

  @test:scripts/tests/readme-sections.test.ts::isSubmoduleRoot_—_`--all`_skips_a_README_another_repository_owns_(bean_kye5)::a_`.git`_FILE_(a_gitdir_pointer)_is_a_submodule
  Scenario: A .git file marks a submodule
    Given a directory whose .git is a gitdir pointer file
    Then it is a submodule root

  @test:scripts/tests/readme-sections.test.ts::isSubmoduleRoot_—_`--all`_skips_a_README_another_repository_owns_(bean_kye5)::a_`.git`_DIRECTORY_is_a_checkout_of_its_own,_and_no_`.git`_is_a_plain_directory
  Scenario: A .git directory or no .git is not a submodule
    Then a directory with a .git directory is not a submodule root
    And a directory with no .git is not one either
