# scripts/subgraph-readmes.ts writes one README per declared directory from the declaration,
# resolving this harness's Extensions (coverage.process, subdirectory rows, stored directories)
# and a --repo flag for another checkout. Each Scenario names the test that executes it.
Feature: Directory READMEs generated from the declaration

  @test:scripts/tests/kg/subgraph-readmes.test.ts::a_directory_README_is_never_a_node,_at_any_depth,_and_nothing_else_is
  Scenario: Only a file named README.md is a directory README, at any depth
    Then "README.md" and "todos/README.md" are directory READMEs
    And "todos/README.md.bak" and "todos/NOT-README.md" are not

  @test:scripts/tests/kg/subgraph-readmes.test.ts::over_the_real_tree,_every_link_in_every_generated_README_resolves
  Scenario: Every link in every generated README of the real tree resolves
    Given the README plan for the real checkout
    When each relative link inside each generated region is decoded
    Then every one names an existing file

  @test:scripts/tests/kg/subgraph-readmes.test.ts::coverage.process_—_declared,_absent,_and_could-not-determine::a_directory_declaring_a_process_embeds_its_rendered_diagram
  Scenario: A directory declaring a process embeds its rendered diagram
    Given a fixture layer whose "drop/" declares coverage.process "demo-flow", with the diagram rendered
    When the READMEs are planned
    Then drop's README contains "## Governing process — demo-flow flow"
    And it embeds the rendered "demo-flow.svg" from the site's assets/img/workflows
    And it links "demo-flow.bpmn" at "../processes/demo-flow.bpmn"
    And it does not contain "Could not determine"

  @test:scripts/tests/kg/subgraph-readmes.test.ts::coverage.process_—_declared,_absent,_and_could-not-determine::the_link_is_declared,_and_the_page_says_so_rather_than_implying_a_match
  Scenario: The page says the process link is declared, not inferred
    Given the fixture layer's "drop/" declaring coverage.process "demo-flow"
    When the READMEs are planned
    Then drop's README says "The link is **declared** in `coverage.process`, not inferred"

  @test:scripts/tests/kg/subgraph-readmes.test.ts::coverage.process_—_declared,_absent,_and_could-not-determine::the_diagram's_boundary_is_read_from_the_element_TYPE,_not_from_its_wording
  Scenario: The diagram's boundary is read from the element type
    Given the fixture's "demo-flow" diagram starts at a start event named "A file lands in drop/"
    When the READMEs are planned
    Then drop's README says it begins at the start **event** “A file lands in drop/”
    And it says the start lies **outside** this diagram

  @test:scripts/tests/kg/subgraph-readmes.test.ts::coverage.process_—_declared,_absent,_and_could-not-determine::each_call_activity_is_a_row,_with_its_declared_skill_and_its_own_diagram
  Scenario: Each call activity is a row with its declared skill and its own diagram
    Given the "demo-flow" diagram with two call activities, one declaring skill "demo-skill" and calling "demo-sub", one calling an undeclared "Process_nowhere"
    When the READMEs are planned
    Then drop's README says "2 of its steps are **call activities**"
    And it has the row "First step [demo-skill]" with skill "demo-skill" linking "demo-sub.bpmn"
    And it has the row "Second step" with no skill, saying it could not determine, as nothing declares "Process_nowhere"

  @test:scripts/tests/kg/subgraph-readmes.test.ts::coverage.process_—_declared,_absent,_and_could-not-determine::a_directory_declaring_NO_process_gets_no_section,_and_that_is_not_a_finding
  Scenario: A directory declaring no process gets no section and no finding
    Given the fixture's "quiet/" declares no process
    When the READMEs are planned
    Then quiet's README contains neither "Governing process" nor "Could not determine"
    And "quiet" is not among the unresolved-process findings

  @test:scripts/tests/kg/subgraph-readmes.test.ts::coverage.process_—_declared,_absent,_and_could-not-determine::a_declared_process_with_no_diagram_says_COULD_NOT_DETERMINE,_and_is_a_finding
  Scenario: A declared process with no diagram cannot be determined and is a finding
    Given the fixture's "claimed/" declares coverage.process "no-such-diagram", which has no diagram
    When the READMEs are planned
    Then claimed's README contains "## Governing process"
    And it says "Could not determine: no diagram named `no-such-diagram.bpmn`"
    And "claimed" is among the unresolved-process findings

  @test:scripts/tests/kg/subgraph-readmes.test.ts::coverage.process_—_declared,_absent,_and_could-not-determine::a_diagram_found_but_never_rendered_also_says_COULD_NOT_DETERMINE
  Scenario: A diagram found but never rendered cannot be determined, without a finding
    Given the fixture's "unrendered/" declares a process whose .bpmn exists but has no rendered SVG
    When the READMEs are planned
    Then unrendered's README says "Could not determine:" and to "run `bun run cat render:bpmn`"
    And "unrendered" is not among the unresolved-process findings

  @test:scripts/tests/kg/subgraph-readmes.test.ts::coverage.process_—_declared,_absent,_and_could-not-determine::the_file_table_is_headed_only_where_a_section_precedes_it
  Scenario: The file table is headed only where a section precedes it
    When the fixture's READMEs are planned
    Then drop's README contains a "## Files" heading
    And quiet's README does not

  @test:scripts/tests/kg/subgraph-readmes.test.ts::a_link_destination_is_percent-encoded_per_segment,_parentheses_included
  Scenario: A link destination is percent-encoded per segment, parentheses included
    Then "PIIS2589750021000388 (2).pdf" encodes to "PIIS2589750021000388%20%282%29.pdf"
    And "a b/c(d.md" encodes to "a%20b/c%28d.md"
    And "plain.md" is unchanged
    And decoding the encoded "x (1) y.pdf" gives it back

  @test:scripts/tests/kg/subgraph-readmes.test.ts::subdirectory_rows_—_described_from_the_declaration,_or_saying_nothing_does_(no_count,_bean_ba9e)::a_declared_part's_row_names_it_with_its_description
  Scenario: A declared part's row names it with its description
    Given a "work/" directory whose beans.json declares "parts" with description "The parts of the plan."
    Then the subdirectory descriptions of "work/" for kind "beans" are exactly parts: "The parts of the plan."
    And work's README has the row for "parts/" with that description

  @test:scripts/tests/kg/subgraph-readmes.test.ts::subdirectory_rows_—_described_from_the_declaration,_or_saying_nothing_does_(no_count,_bean_ba9e)::a_promoted_(`subgraph:_true`)_directory_describes_itself_elsewhere;_its_row_borrows_nothing
  Scenario: A promoted subgraph directory's row borrows nothing
    Given beans.json declares "promoted" with subgraph true and description "Its own subgraph."
    When work's README is planned
    Then the row for "promoted/" says "_nothing declares what this holds_"
    And the README does not contain "Its own subgraph."

  @test:scripts/tests/kg/subgraph-readmes.test.ts::subdirectory_rows_—_described_from_the_declaration,_or_saying_nothing_does_(no_count,_bean_ba9e)::no_description,_or_no_declaration_at_all,_says_so_—_nothing_is_invented,_and_nothing_is_counted
  Scenario: An undescribed or undeclared subdirectory says nothing declares it, with no count
    Given beans.json declares "nodesc" with no description and does not declare "undeclared"
    When work's README is planned
    Then the rows for "nodesc/" and "undeclared/" say "_nothing declares what this holds_"
    And the README contains no "1 file" count
    And the nested "parts/deep" description "Not a row of work/." does not appear

  @test:scripts/tests/kg/subgraph-readmes.test.ts::subdirectory_rows_—_described_from_the_declaration,_or_saying_nothing_does_(no_count,_bean_ba9e)::a_directory_whose_kind_names_no_declaration_file_supplies_nothing
  Scenario: A kind that names no declaration file supplies no descriptions
    Then the subdirectory descriptions of "work/" for kind "no-such-kind" are empty
    And those of "work/undeclared" for kind "beans" are empty

  @test:scripts/tests/kg/subgraph-readmes.test.ts::a_subgraph_kept_OFF_the_checkout_is_not_described_from_it_(bean_9c7h)::fsh-guts,_kept_on_its_branch,_is_not_among_the_directories_whose_README_this_tree_writes
  Scenario: fsh-guts, kept on its branch, is not among the directories cat-harness writes READMEs for
    When cat-harness's directories are resolved for READMEs
    Then there are more than 20 of them
    And "fsh-guts" is not among them

  @test:scripts/tests/kg/subgraph-readmes.test.ts::a_stored_directory:_the_plan_is_the_same_with_and_without_its_working_copy::the_stored_directory_is_not_among_the_harness's_directories
  Scenario: A stored directory is not among the harness's directories
    Given a fixture layer declaring "tests/" and a "qa" directory at "tests/results/" stored on branch "qa-reports"
    When its directories are resolved for READMEs
    Then "tests" is among them and "qa" is not

  @test:scripts/tests/kg/subgraph-readmes.test.ts::a_stored_directory:_the_plan_is_the_same_with_and_without_its_working_copy::every_planned_README_is_byte-identical,_and_none_is_written_into_the_stored_directory
  Scenario: The README plan is byte-identical with and without the stored working copy
    Given the fixture's plan made before and after a working copy of "tests/results/" is written
    Then both plans write the same README paths
    And each README's text is identical
    And no README is planned inside "tests/results"

  @test:scripts/tests/kg/subgraph-readmes.test.ts::a_stored_directory:_the_plan_is_the_same_with_and_without_its_working_copy::the_findings_are_identical_too,_and_the_absent_working_copy_is_not_`absent-directory`
  Scenario: The findings are identical, and the absent working copy is not an absent directory
    Given the fixture's plan made before and after a working copy of "tests/results/" is written
    Then both plans have identical findings
    And the plan without the working copy has no absent-directory finding

  @test:scripts/tests/kg/subgraph-readmes.test.ts::isStored_(bean_lehh)::a_branch_FAMILY_is_stored:_no_README_is_written_into_its_empty_mount_path
  Scenario: A branch family or a branch makes a directory stored
    # Gap: that no README is written into the empty mount path is not checked here, only isStored
    Then a storage with a branchPrefix keyed by "family" is stored
    And a storage with a branch keyed by "tip" is stored
    And an entry with no storage is not stored

  @test:scripts/tests/kg/subgraph-readmes.test.ts::--repo:_the_READMEs_of_another_checkout,_and_nothing_else::the_flag_is_read_in_both_spellings,_and_a_missing_value_is_refused_rather_than_ignored
  Scenario: The --repo flag is read in both spellings and refuses a missing value
    Then no arguments give no repo
    And "--check --repo x/y" and "--repo=x/y" both give the resolved "x/y"
    And "--repo" alone, "--repo --check" and "--repo=" each fail with "--repo needs a directory"

  @test:scripts/tests/kg/subgraph-readmes.test.ts::--repo:_the_READMEs_of_another_checkout,_and_nothing_else::a_stale_README_fails_--check,_the_writer_repairs_it_in_that_checkout,_and_--check_then_passes
  Scenario: A stale README in another checkout fails --check, is repaired, then passes
    Given a git checkout of a layer declaring "work/" holding a tracked "plan.txt", with no README there
    When the script is run with "--check --repo" on it
    Then it exits 1 saying "work/README.md is stale" and writes no README
    And run with "--repo" it exits 0 and writes a README linking "plan.txt"
    And run again with "--check --repo" it exits 0

  @test:scripts/tests/kg/subgraph-readmes.test.ts::--repo:_the_READMEs_of_another_checkout,_and_nothing_else::a_directory_with_no_instance_declaration_is_UNKNOWN_(exit_2),_never_a_clean_run
  Scenario: A directory with no instance declaration is unknown, not clean
    Given an empty directory
    When the script is run with "--check --repo" on it
    Then it exits 2
    And it says the directory "holds no instance declaration"
