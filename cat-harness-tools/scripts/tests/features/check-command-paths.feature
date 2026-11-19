# scripts/check-command-paths.ts finds paths named in shell blocks, .mcp.json and printed commands that
# no longer resolve from the checkout root. Each Scenario names the test that executes it.
Feature: Command paths resolve from the checkout root

  @test:scripts/tests/check-command-paths.test.ts::a_word_is_judged_WHOLE,_never_as_a_path-shaped_run_inside_one::%s_does_not_yield_%s
  Scenario: A shell word is judged whole, never as a path-shaped run inside it
    Given a command and a path-shaped fragment of one of its words
    When the command is split into shell words
    Then the fragment is not among the words
    And the rows are: "bun.sh/install" from a curl URL, "HOME/.local/bin" from a PATH export, "path/to/your/content-repo" from a "--repo" argument, and "file.bpmn" from "<file.bpmn|dir>"

  @test:scripts/tests/check-command-paths.test.ts::a_word_is_judged_WHOLE,_never_as_a_path-shaped_run_inside_one::an_assignment_is_not_a_path
  Scenario: An assignment is not a path
    Given the word "SMART_BASE_HOME=/path/to/smart-base"
    When its skip reason is asked
    Then the reason is "an assignment"

  @test:scripts/tests/check-command-paths.test.ts::a_word_is_judged_WHOLE,_never_as_a_path-shaped_run_inside_one::an_upper-case_segment_is_a_stand-in
  Scenario: A path with an upper-case segment is a stand-in
    Given the words "uploads/FILE.pdf" and "beans/defs"
    When their skip reasons are asked
    Then "uploads/FILE.pdf" is skipped as "an upper-case stand-in"
    And "beans/defs" is not skipped

  @test:scripts/tests/check-command-paths.test.ts::whole_commands_the_check_declines::a_`cd`_moves_the_base,_so_the_rest_is_not_root-relative
  Scenario: A command that changes directory is declined
    Given the command "cd content && bun run pipeline/bib-qa.ts"
    When the command's skip reason is asked
    Then it is declined because it changes directory

  @test:scripts/tests/check-command-paths.test.ts::whole_commands_the_check_declines::a_git_ref_is_path-shaped_and_is_not_a_path
  Scenario: A git command naming a ref is declined
    Given the command "git show origin/main:beans/defs/x.md"
    When the command's skip reason is asked
    Then it is declined as a git command

  @test:scripts/tests/check-command-paths.test.ts::whole_commands_the_check_declines::an_ordinary_command_is_not_declined
  Scenario: An ordinary command is not declined
    Given the command "bun run cat-harness/scripts/install-beans.sh"
    When the command's skip reason is asked
    Then it is not declined

  @test:scripts/tests/check-command-paths.test.ts::the_skill_corpus_judges_only_what_claims_to_be_about_this_tree::a_path_under_an_existing_root_directory_is_judged
  Scenario: A skill path under an existing root directory is judged
    Given a tree with "cat-harness" and "beans" directories
    When "cat-harness/scripts/x.ts" is asked whether it is about this tree
    Then it is

  @test:scripts/tests/check-command-paths.test.ts::the_skill_corpus_judges_only_what_claims_to_be_about_this_tree::a_folio's_path_is_not_—_the_platform_carries_no_folio
  Scenario: A folio's path in a skill is not judged
    Given the same tree, which has no "content" directory
    When "content/pipeline/qa-sweep.ts" and "./scripts/tests/run-tests.sh" are asked whether they are about this tree
    Then neither is

  @test:scripts/tests/check-command-paths.test.ts::the_skill_corpus_judges_only_what_claims_to_be_about_this_tree::a_bare_MARKDOWN_name_is_judged_—_the_`z9eb`_case
  Scenario: A bare markdown name in a skill is judged
    Given the same tree
    When "STATUS.md" is asked whether it is about this tree
    Then it is

  @test:scripts/tests/check-command-paths.test.ts::the_skill_corpus_judges_only_what_claims_to_be_about_this_tree::a_bare_non-markdown_name_is_a_folio_artefact,_not_judged
  Scenario: A bare non-markdown name in a skill is not judged
    Given the same tree
    When "harness.config.json" and "proof-objects.json" are asked whether they are about this tree
    Then neither is

  @test:scripts/tests/check-command-paths.test.ts::a_FOLIO-OWNED_head_is_declined_even_when_that_directory_exists_HERE::`docs/`,_`content/`_and_`uploads/`_are_declined_although_present
  Scenario: Folio-owned heads are declined even when present in the tree
    Given a tree with "cat-harness", "docs", "content" and "uploads" directories
    When "docs/audits/x.json", "content/pipeline/qa-sweep.ts" and "uploads/a.pdf" are asked whether they are about this tree
    Then none is

  @test:scripts/tests/check-command-paths.test.ts::a_FOLIO-OWNED_head_is_declined_even_when_that_directory_exists_HERE::...and_a_head_that_is_NOT_folio-owned_is_still_judged,_which_is_the_contrast
  Scenario: A head that is not folio-owned is still judged alongside them
    Given the same tree with folio-owned directories present
    When "cat-harness/scripts/x.ts" is asked whether it is about this tree
    Then it is

  @test:scripts/tests/check-command-paths.test.ts::a_FOLIO-OWNED_head_is_declined_even_when_that_directory_exists_HERE::the_PLATFORM's_own_docs_keep_their_instance_prefix,_and_stay_judged
  Scenario: The platform's own docs, spelled with their instance prefix, are judged
    Given the same tree
    When "cat-harness/docs/guides/agent-onboarding.md" is asked whether it is about this tree
    Then it is

  @test:scripts/tests/check-command-paths.test.ts::the_exemption_carries_a_reason_and_is_counted::a_marked_block_is_exempt;_an_unmarked_one_is_not
  Scenario: A shell block marked with a reason is exempt and an unmarked one is not
    Given markdown with a "command-path-ok: a probe" marker before one sh block and a second unmarked sh block
    When its shell blocks are read
    Then there are two blocks
    And the first is exempt and the second is not

  @test:scripts/tests/check-command-paths.test.ts::the_exemption_carries_a_reason_and_is_counted::a_marker_with_no_reason_does_not_exempt_—_silencing_costs_more_than_fixing
  Scenario: A marker with no reason does not exempt
    Given an sh block preceded by "command-path-ok:" with an empty reason
    When its shell blocks are read
    Then the block is not exempt

  @test:scripts/tests/check-command-paths.test.ts::the_defect_it_was_written_for::a_moved_script_in_an_entry_document_fails
  Scenario: A moved script named in an entry document is a dead path
    Given AGENTS.md naming "scripts/install-beans.sh" while the script lives at "cat-harness/scripts/install-beans.sh"
    When the command paths are checked
    Then the only dead token is "scripts/install-beans.sh"

  @test:scripts/tests/check-command-paths.test.ts::the_defect_it_was_written_for::...and_passes_once_repointed
  Scenario: The entry document passes once repointed
    Given AGENTS.md naming "cat-harness/scripts/install-beans.sh", which exists
    When the command paths are checked
    Then there are no dead paths

  @test:scripts/tests/check-command-paths.test.ts::the_defect_it_was_written_for::a_moved_MCP_server_script_in_`.mcp.json`_fails_—_the_2026-09-30_case
  Scenario: A moved MCP server command in .mcp.json is a dead path
    Given .mcp.json whose server command is "scripts/sage-mcp.sh" while it lives under "cat-harness/scripts/"
    When the command paths are checked
    Then the only dead path is "scripts/sage-mcp.sh" in ".mcp.json"

  @test:scripts/tests/check-command-paths.test.ts::the_defect_it_was_written_for::...an_`args`_path_is_judged_too,_and_both_pass_once_repointed
  Scenario: An MCP server args path is judged, and both pass once repointed
    Given .mcp.json whose server args name "src/index.ts" while it lives under "cat-harness/src/"
    When the command paths are checked
    Then the only dead token is "src/index.ts"
    And when the command and args are repointed under "cat-harness/", there are no dead paths

  @test:scripts/tests/check-command-paths.test.ts::the_defect_it_was_written_for::EXAMINED_NOTHING_is_not_a_pass
  Scenario: An empty tree reads no files
    # Gap: only the zero file count is checked, not that the run is reported as a failure
    Given an empty tree
    When the command paths are checked
    Then the number of files read is 0

  @test:scripts/tests/check-command-paths.test.ts::the_printed-command_reader_—_bean_`b963`'s_third_class::a_runner_verb_before_a_path_that_resolves_only_under_an_instance_is_FOUND,_with_its_fix
  Scenario: A runner verb before a path found only under an instance fails with its fix
    Given an instance "cat-harness" whose script prints "bun run scripts/lean-audit.ts", which exists under the instance
    When the command paths are checked
    Then the only dead token is "scripts/lean-audit.ts  →  cat-harness/scripts/lean-audit.ts"
    And nothing is held

  @test:scripts/tests/check-command-paths.test.ts::the_printed-command_reader_—_bean_`b963`'s_third_class::a_cross-reference_with_NO_runner_verb_is_not_a_finding
  Scenario: A cross-reference with no runner verb is not a finding
    Given an instance script whose comment says "see `scripts/known-skills.ts`" with no runner verb
    When the command paths are checked
    Then nothing is held

  @test:scripts/tests/check-command-paths.test.ts::the_printed-command_reader_—_bean_`b963`'s_third_class::`node`_is_not_a_runner_verb_here_—_it_is_an_ordinary_word_in_this_codebase
  Scenario: The word "node" is not treated as a runner verb
    Given an instance script whose comment uses "node" as an ordinary word before paths
    When the command paths are checked
    Then nothing is held

  @test:scripts/tests/check-command-paths.test.ts::the_printed-command_reader_—_bean_`b963`'s_third_class::a_path_that_resolves_nowhere_is_a_folio's_—_counted,_never_held
  Scenario: A printed command whose path resolves nowhere is counted as folio-relative
    Given an instance script printing "bun run content/pipeline/x.ts", which exists nowhere
    When the command paths are checked
    Then nothing is held
    And the folio-relative count is above 0

  @test:scripts/tests/check-command-paths.test.ts::the_printed-command_reader_—_bean_`b963`'s_third_class::a_command_in_a_code_span_ends_at_the_span:_later_prose_on_the_line_is_not_read_as_its_arguments
  Scenario: A command in a code span ends at the span
    Given an instance script whose comment has "`bun run cat some:baseline`" followed by prose naming "`schemas/`"
    When the command paths are checked
    Then there are no dead paths

  @test:scripts/tests/check-command-paths.test.ts::the_printed-command_reader_—_bean_`b963`'s_third_class::...while_a_path_INSIDE_the_span_is_still_judged
  Scenario: A path inside the code span is still judged
    Given an instance script whose comment has "`bun run scripts/lean-audit.ts`", which exists only under the instance
    When the command paths are checked
    Then the only dead token is "scripts/lean-audit.ts  →  cat-harness/scripts/lean-audit.ts"

  @test:scripts/tests/check-command-paths.test.ts::the_printed-command_reader_—_bean_`b963`'s_third_class::instance_roots_are_DISCOVERED,_so_a_split_cannot_silently_blind_the_check
  Scenario: Instance roots are discovered from their declaration files
    Given a tree with "cat-harness/cat-harness.json" and "other/other.json"
    When the instance roots are listed
    Then they are "cat-harness" and "other"

  @test:scripts/tests/check-command-paths.test.ts::the_owner's_verdict_on_the_237_—_fail_on_scripts/,_count_content/::a_command_naming_this_repository's_tooling_FAILS,_and_the_finding_carries_its_fix
  Scenario: A command naming this repository's tooling fails and carries its fix
    Given an instance script printing "bun run scripts/lean-audit.ts", present under "cat-harness/"
    When the command paths are checked
    Then there is one dead path, "scripts/lean-audit.ts  →  cat-harness/scripts/lean-audit.ts"
    And nothing is held

  @test:scripts/tests/check-command-paths.test.ts::the_owner's_verdict_on_the_237_—_fail_on_scripts/,_count_content/::a_command_addressed_to_a_FOLIO_is_counted,_never_failed
  Scenario: A command addressed to a folio is held, not failed
    Given an instance script printing "bun run content/pipeline/qa-sweep.ts", present under "cat-harness/"
    When the command paths are checked
    Then there are no dead paths
    And one finding is held

  @test:scripts/tests/check-command-paths.test.ts::the_owner's_verdict_on_the_237_—_fail_on_scripts/,_count_content/::`%s/`_is_a_folio's,_so_it_is_counted
  Scenario: Each folio-owned head is not failed
    Given an instance script printing "bun run <head>/x.ts", present under "cat-harness/"
    When the command paths are checked
    Then there are no dead paths
    And the rows are every folio-owned head: folio, content, uploads, library, lean and .lake

  @test:scripts/tests/check-command-paths.test.ts::the_owner's_verdict_on_the_237_—_fail_on_scripts/,_count_content/::`%s/`_is_this_repository's,_so_it_fails
  Scenario: This repository's own heads fail
    Given an instance script printing "bun run <head>/x.ts", present under "cat-harness/"
    When the command paths are checked
    Then there is one dead path
    And the rows are "scripts", "src" and "docs"

  @test:scripts/tests/check-command-paths.test.ts::the_owner's_verdict_on_the_237_—_fail_on_scripts/,_count_content/::FOLIO_OWNED_is_a_LAYOUT_and_not_a_declaration_—_the_weakness_is_on_the_constant
  Scenario: The folio-owned set holds content and not scripts
    # Gap: only the set's membership is checked, not that it is a layout rather than a declaration
    Given the folio-owned head set
    Then it contains "content"
    And it does not contain "scripts"

  @test:scripts/tests/check-command-paths.test.ts::the_corpus_is_DISCOVERED,_not_listed::a_new_instance's_scripts/_is_scanned_without_anyone_editing_this_check
  Scenario: A new instance's scripts directory is scanned without editing the check
    Given a "who-iris" instance whose script prints "bun run scripts/gen-iris-pages.ts", present under "who-iris/scripts/"
    When the command paths are checked
    Then the source files include "who-iris/scripts/a.ts"
    And the only dead token is "scripts/gen-iris-pages.ts  →  who-iris/scripts/gen-iris-pages.ts"

  @test:scripts/tests/check-command-paths.test.ts::a_declared_move::in_the_window_the_old_path_passes,_and_each_use_is_reported_as_moved
  Scenario: Within a declared move's window the old path passes and is reported as moved
    Given AGENTS.md and .mcp.json naming "cat-harness/old/x.ts", and cat-harness declaring a move from "old" to "new" until 2099-12-31
    When the command paths are checked
    Then there are no dead paths
    And each use is reported as moved by "cat-harness:old", in AGENTS.md and then .mcp.json

  @test:scripts/tests/check-command-paths.test.ts::a_declared_move::past_`until`_the_move_gives_no_relief
  Scenario: Past its until date a declared move gives no relief
    Given the same move declared until 2020-01-01
    When the command paths are checked
    Then nothing is reported as moved
    And the old path is dead in both ".mcp.json" and "AGENTS.md"
