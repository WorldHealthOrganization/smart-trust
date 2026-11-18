# Specifies the evidence probes of the health sweep (test/health/probes.ts):
# probeBranches, probeStaging, probeRepoSize, probeTodos and
# probeSpecialBranches against throwaway git repositories, and the parses
# frontMatter, frontMatterValue, countConsideredOptions and doneWhenState.
# Each probe answers ok with a value, or unknown with a reason.
Feature: The health probes gather evidence, and tell a determined empty from a failure to look

  @test:test/health/probes.test.ts::probeBranches::tells_a_merged_branch_from_one_that_carries_unmerged_work,_and_dates_both
  Scenario: A merged branch and an unmerged branch are told apart and dated
    Given a remote whose "main" has merged "claude/merged" with a merge commit, and a later "claude/still-going" that is not merged
    And a local repository with that remote as "origin"
    When the branches are probed for the preview slugs "claude-merged" and "claude-still-going"
    Then the state is "ok" and the default branch is "main"
    And the candidates are exactly "claude/merged" and "claude/still-going"
    And "claude/merged" is merged into the default branch and "claude/still-going" is not
    And no candidate is unevaluated, and each has a parseable head commit date

  @test:test/health/probes.test.ts::probeBranches::carries_only_the_branches_a_preview_slug_asks_about_—_226_branches_must_not_cost_226_fetches
  Scenario: Only the branches a preview slug names are carried
    Given the remote with "claude/merged" and "claude/still-going"
    And five more unmerged branches "claude/other-0" to "claude/other-4" on it
    And a `git` on PATH that logs every fetch before running the real one
    When the branches are probed for the preview slug "claude-still-going" alone
    Then the state is "ok"
    And the candidates are exactly "claude/still-going"
    And exactly two fetches were made: "fetch --no-tags origin main" and "fetch --no-tags origin refs/heads/claude/still-going"

  @test:test/health/probes.test.ts::probeBranches::an_empty_candidate_set_is_a_DETERMINED_answer,_not_a_failure_to_look
  Scenario: No branch matching a slug is a determined empty answer
    Given the remote with "claude/merged" and "claude/still-going"
    When the branches are probed for the preview slug "claude-no-such-branch"
    Then the state is "ok"
    And the candidates are empty and the default branch is "main"

  @test:test/health/probes.test.ts::probeBranches::a_remote_that_cannot_be_reached_is_`unknown`,_never_an_empty_candidate_set
  Scenario: An unreachable remote makes the branch probe unknown
    Given a repository whose "origin" points at a path that does not exist
    When the branches are probed for the preview slug "claude-anything"
    Then the state is "unknown"
    And the reason contains "ls-remote"

  @test:test/health/probes.test.ts::probeBranches::is_NOT_blinded_by_a_shallow_fetch_of_a_DIFFERENT_branch_—_the_`gh-pages_--depth=1`_case
  Scenario: A shallow fetch of another branch does not blind the merge answer
    Given the local repository has fetched "claude/still-going" from the remote with depth 1
    When the branches are probed for the preview slug "claude-merged"
    Then the state is "ok"
    And "claude/merged" is merged into the default branch

  @test:test/health/probes.test.ts::probeBranches::still_trusts_`not_merged`_for_a_branch_whose_tip_POSTDATES_the_graft_boundary
  Scenario: A branch whose tip is newer than the graft boundary is still "not merged"
    Given the local repository has fetched "main" from the remote with depth 1
    When the branches are probed for the preview slug "claude-still-going"
    Then the state is "ok"
    And "claude/still-going" is not merged into the default branch
    And it is not unevaluated

  @test:test/health/probes.test.ts::probeBranches::refuses_to_call_a_branch_unmerged_when_the_default_branch's_history_is_truncated_past_its_tip
  Scenario: A branch whose tip is older than the graft boundary is left unevaluated
    Given the local repository has fetched "main" from the remote with depth 1
    When the branches are probed for the preview slug "claude-merged"
    Then the state is "ok"
    And "claude/merged" is a candidate with no merged answer
    And its unevaluated reason contains "fetch-depth: 0" and "graft boundary"

  @test:test/health/probes.test.ts::probeStaging::reads_the_previews_and_sums_their_blob_sizes
  Scenario: The staging probe lists the previews and sums their blob sizes
    Given a repository with "STAGING/claude-one" holding 1000 and 500 bytes, "STAGING/claude-two" holding 2000 bytes, and a top-level index.html
    When staging is probed at the local revision HEAD
    Then the state is "ok"
    And the preview slugs are "claude-one" and "claude-two"
    And "claude-one" has 1500 bytes in 2 files and "claude-two" has 2000 bytes

  @test:test/health/probes.test.ts::probeStaging::a_branch_with_no_STAGING_directory_is_a_DETERMINED_empty,_not_an_unknown
  Scenario: A publish branch with no STAGING directory has no previews
    Given a repository holding only index.html
    When staging is probed at the local revision HEAD
    Then the state is "ok"
    And the branch is "present" and the previews are empty

  @test:test/health/probes.test.ts::probeStaging::a_publish_branch_that_positively_does_not_exist_is_`ok`/`absent`_—_the_first-deploy_case
  Scenario: A remote with no publish branch is "absent", not unknown
    Given a reachable bare remote with no "gh-pages" branch
    When staging is probed against that remote
    Then the state is "ok"
    And the branch is "absent" and the previews are empty

  @test:test/health/probes.test.ts::probeStaging::a_remote_that_cannot_be_reached_is_`unknown`,_and_says_which_command_failed
  Scenario: An unreachable remote makes the staging probe unknown, naming the command
    Given a repository whose "origin" points at a directory that does not exist
    When staging is probed against that remote
    Then the state is "unknown"
    And the reason contains "git ls-remote"

  @test:test/health/probes.test.ts::probeRepoSize::measures_tracked_blobs_at_HEAD,_not_the_working_tree
  Scenario: Repository size counts tracked blobs, not untracked files
    Given a repository with tracked files of 4096 and 2048 bytes and an untracked 1,000,000-byte file
    When the repository size is probed
    Then the state is "ok"
    And the tracked bytes are 6144
    And the git directory bytes are greater than 0

  @test:test/health/probes.test.ts::probeRepoSize::is_`unknown`_outside_a_repository_rather_than_reporting_a_zero-byte_one
  Scenario: Repository size outside a repository is unknown
    Given an empty directory that is not a git repository
    When the repository size is probed
    Then the state is "unknown"

  @test:test/health/probes.test.ts::probeTodos::reads_the_declared_store,_following_todos.json_rather_than_a_hardcoded_path
  Scenario: The todo probe follows the directory todos.json declares
    Given a todos.json declaring the todo-items directory at "elsewhere"
    And a todo "one" under todos/elsewhere and a decoy under todos/items
    When the todos are probed
    Then the state is "ok"
    And the todo ids are exactly "one"

  @test:test/health/probes.test.ts::probeTodos::a_PRESENT_but_unreadable_declaration_is_`unknown`,_never_a_fallback_to_the_default_path
  Scenario: An unparseable todos.json makes the todo probe unknown
    Given a todos.json that is not valid JSON, and a todo under todos/items
    When the todos are probed
    Then the state is "unknown"
    And the reason contains "todos.json"

  @test:test/health/probes.test.ts::front_matter::reads_a_quoted_title,_which_`beans`_writes_whenever_the_value_holds_a_colon
  Scenario: A single-quoted title holding a colon is read unquoted
    Given front matter with a comment line, title 'Workflow failure: invisible' and status todo
    When the front matter is parsed
    Then the title is "Workflow failure: invisible"
    And the status is "todo"
    And "updated_at" is undefined

  @test:test/health/probes.test.ts::front_matter::returns_undefined_for_a_file_with_no_front_matter_at_all
  Scenario: A file with no front matter has none
    Given the text "# just a heading"
    When the front matter is parsed
    Then it is undefined

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::returns_`undefined`_for_a_bean_with_no_options_section,_never_0
  Scenario: A bean with no options section has no option count
    Given a bean body with a heading "# Work" and no options section
    When its considered options are counted
    Then the count is undefined

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::matches_the_spellings_this_store_ACTUALLY_uses,_not_only_MADR's_canonical_heading
  Scenario: Each options heading spelling is recognised
    Given sections headed "## Considered options", "## Options", "## Options, with what each costs" and "## OPTIONS", each with two list items
    When the considered options of each are counted
    Then each count is 2

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::does_not_read_`##_Optional`_as_an_options_section
  Scenario: "## Optional" is not an options section
    Given a section headed "## Optional extras" with two list items
    When its considered options are counted
    Then the count is undefined

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::counts_`-`,_`*`_and_numbered_items_alike
  Scenario: Numbered and starred items are counted
    Given an options section of three numbered items
    And an options section of two "*" items
    When the considered options of each are counted
    Then the counts are 3 and 2

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::an_option's_own_sub-points_are_not_options
  Scenario: Indented sub-points are not counted as options
    Given an options section of two items, each with indented sub-points
    When its considered options are counted
    Then the count is 2

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::stops_at_the_next_section,_and_a_`###`_inside_an_option_does_not_end_it
  Scenario: A "###" inside the section does not end it; the next "##" does
    Given an options section with an item, a "###" subheading followed by an item, then "## Decision" followed by an item
    When its considered options are counted
    Then the count is 2

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::counts_options_written_as_BOLD_ENUMERATED_paragraphs_—_`j6t3`,_`xgd8`
  Scenario: Bold enumerated paragraphs are counted as options
    Given an options section whose options are the paragraphs "**A. ...**" and "**B. ...**", each followed by a For/Against line
    When its considered options are counted
    Then the count is 2

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::counts_options_written_as_SUBHEADINGS,_not_their_pros_and_cons_—_`dhvf`
  Scenario: Option subheadings are counted, not their pro and con bullets
    Given a "## Considered options" section with subheadings "### A — ..." and "### B — ...", each over two bullets
    When its considered options are counted
    Then the count is 2

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::an_ordinary_subheading_inside_the_section_is_not_an_option
  Scenario: Subheadings that are not lettered options are not counted
    Given an options section with bold options "A" and "B" and two ordinary "###" subheadings
    When its considered options are counted
    Then the count is 2

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::a_subheading_form_OUTRANKS_bare_list_items_in_the_same_section
  Scenario: Option subheadings outrank the list items under them
    Given an options section with subheadings "### A. one" and "### B. two", each over two list items
    When its considered options are counted
    Then the count is 2

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::plain_list_items_still_count_when_no_other_form_appears_—_the_9_that_already_worked
  Scenario: Plain list items are counted when no other form appears
    Given an options section of three list items
    When its considered options are counted
    Then the count is 3

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::an_options_section_with_no_items_is_0_—_a_real,_reportable_count
  Scenario: An options section with no items counts 0
    Given an options section holding only "(to be decided)"
    When its considered options are counted
    Then the count is 0

  @test:test/health/probes.test.ts::countConsideredOptions_—_the_parse_the_MADR_criterion_rests_on::takes_the_FIRST_options_section_when_a_bean_revisits_the_decision
  Scenario: The first options section is the one counted
    Given an options section of one item, a later section, and "## Options, revisited" with three items
    When its considered options are counted
    Then the count is 1

  @test:test/health/probes.test.ts::doneWhenState_—_the_four_states_`fkjo`_needs_kept_apart::reads_every_Done-when_spelling_the_store_actually_uses
  Scenario: Each Done-when heading spelling is recognised
    Given sections headed "## Done when", "### Done when", "## Done when — revised", "## Done when — REPLACES the list above" and "## DONE WHEN", each with one ticked box
    When the Done-when state of each is read
    Then each is all-ticked with a total of 1

  @test:test/health/probes.test.ts::doneWhenState_—_the_four_states_`fkjo`_needs_kept_apart::an_unticked_box_is_an_open_bean,_and_the_partial_count_is_kept
  Scenario: An unticked box makes the bean open, keeping the counts
    Given a Done-when section with one ticked and one unticked box
    When its Done-when state is read
    Then it is open with 1 ticked of 2

  @test:test/health/probes.test.ts::doneWhenState_—_the_four_states_`fkjo`_needs_kept_apart::no_Done-when_section_is_`absent`_—_not_an_empty_pass
  Scenario: A bean with no Done-when section is absent
    Given a bean body with no Done-when section
    When its Done-when state is read
    Then it is absent

  @test:test/health/probes.test.ts::doneWhenState_—_the_four_states_`fkjo`_needs_kept_apart::a_Done-when_carrying_no_checkbox_is_`unreadable`_—_criteria_this_cannot_judge
  Scenario: A Done-when section with no checkbox is unreadable
    Given a Done-when section of two plain list items
    When its Done-when state is read
    Then it is unreadable

  @test:test/health/probes.test.ts::doneWhenState_—_the_four_states_`fkjo`_needs_kept_apart::`unreadable`_OUTRANKS_a_fully_ticked_sibling_section_—_the_`z4mq`_shape
  Scenario: An unreadable Done-when section outranks a fully ticked sibling
    Given a Done-when section of bullet-character items, and a "## Done when — item 3" section with three ticked boxes
    When its Done-when state is read
    Then it is unreadable

  @test:test/health/probes.test.ts::doneWhenState_—_the_four_states_`fkjo`_needs_kept_apart::a_sibling_h2_ends_the_section,_so_a_`##_Do_not`_list_is_not_read_as_criteria
  Scenario: A following "## Do not" section is not read as criteria
    Given a Done-when section with one ticked box, then "## Do not" with an unticked box
    When its Done-when state is read
    Then it is all-ticked with a total of 1

  @test:test/health/probes.test.ts::doneWhenState_—_the_four_states_`fkjo`_needs_kept_apart::a_DEEPER_heading_does_not_end_it_—_criteria_may_carry_a_note
  Scenario: A deeper heading inside the section does not end it
    Given a Done-when section with one ticked box, then "#### Note" with an unticked box
    When its Done-when state is read
    Then it is open with 1 ticked of 2

  @test:test/health/probes.test.ts::doneWhenState_—_the_four_states_`fkjo`_needs_kept_apart::a_bare_`[x]`_with_no_list_marker_counts_—_the_store_writes_both
  Scenario: A bare "[x]" with no list marker counts as ticked
    Given a Done-when section of two bare "[x]" lines
    When its Done-when state is read
    Then it is all-ticked with a total of 2

  @test:test/health/probes.test.ts::doneWhenState_—_the_four_states_`fkjo`_needs_kept_apart::the_real_store_yields_all_four_states_—_not_a_parse_that_matches_nothing
  Scenario: The real bean store and its archive yield all four Done-when states
    Given the beans probed at the current working directory
    Then the probe's state is "ok", and any other state fails the test
    Given, when there is a bean archive, the Done-when state of each archived bean
    When the Done-when kinds are collected
    Then they include "all-ticked", "open", "absent" and "unreadable"

  @test:test/health/probes.test.ts::probeSpecialBranches_—_unique_bytes::counts_a_blob_once_however_many_paths_name_it,_which_is_what_a_clone_costs
  Scenario: A blob named by several paths is counted once
    Given a remote branch "cat/cat-harness/qa-reports" whose files hold one 1000-byte body under two paths and a 2-byte file
    When the special branches are probed for that branch row
    Then the state is "ok"
    And the branch has 3 files and 1002 bytes
