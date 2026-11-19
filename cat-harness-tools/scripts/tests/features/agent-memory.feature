# What scripts/agent-memory.ts does: read the memory graph, render each agent's memory and splice it between markers in the
# generated memory files, AGENTS.md and the Antigravity rule and skill, within each target's budget, reporting what was dropped.
# Each Scenario names the test that executes it.
Feature: Agent memory generation

  @test:scripts/tests/agent-memory.test.ts::the_corpus::the_overflow_check_can_actually_fire
  Scenario: The overflow check reports an entry whose heading lands past the line budget
    Given a file of one line, 210 filler lines and then the heading "## TRAP — dropped"
    When the entries past the budget are measured
    Then the result is "TRAP — dropped"
    And with a budget of 1000 lines the result is empty

  @test:scripts/tests/agent-memory.test.ts::the_parse_keeps_non-entries_out::only_labelled_headings_are_entries
  Scenario: Only labelled headings are parsed as entries
    Given a memory file with a title, a preamble, entries "STABLE — one" and "TRAP — two", and a "## Session log"
    When it is parsed
    Then the entry summaries are "one" and "two"

  @test:scripts/tests/agent-memory.test.ts::the_parse_keeps_non-entries_out::the_session_log_is_NOT_swallowed_into_the_last_entry's_body
  Scenario: The session log is not swallowed into the last entry's body
    Given the same memory file
    When it is parsed
    Then the comment of entry "two" is exactly "body two"

  @test:scripts/tests/agent-memory.test.ts::the_parse_keeps_non-entries_out::a_label_that_is_not_one_of_the_three_is_not_an_entry
  Scenario: A heading whose label is not stable, trap or baseline is not an entry
    When "## NOTES — hello" with a body is parsed
    Then no entry is found

  @test:scripts/tests/agent-memory.test.ts::splice_writes_only_between_the_markers::everything_outside_the_region_survives_verbatim
  Scenario: Splicing replaces only the text between the markers
    Given a file with "head", the begin marker, "old", the end marker, "tail" and a session log entry "- kept"
    When the region is spliced with "new"
    Then the result still starts with "head" and keeps the session log verbatim
    And it contains "new" and no longer contains "old"

  @test:scripts/tests/agent-memory.test.ts::splice_writes_only_between_the_markers::a_file_with_NO_markers_is_refused,_not_rewritten
  Scenario: A file without markers is refused, not rewritten
    When "no markers here" is spliced with "new"
    Then the splice returns nothing

  @test:scripts/tests/agent-memory.test.ts::splice_writes_only_between_the_markers::markers_in_the_wrong_order_are_refused_too
  Scenario: Markers in the wrong order are refused
    When a file with the end marker before the begin marker is spliced
    Then the splice returns nothing

  @test:scripts/tests/agent-memory.test.ts::rendering::slugify_is_stable_and_url-safe
  Scenario: slugify turns a heading into a stable url-safe slug
    When "`uses[]` is EDITORIAL, and immediate-neighbours only" is slugified
    Then the slug is "uses-is-editorial-and-immediate-neighbours-only"

  @test:scripts/tests/agent-memory.test.ts::archived_entries_are_retained_but_injected_nowhere::archived_beats_UNTAGGED,_which_is_the_ordering_that_matters
  Scenario: An archived untagged node reaches no agent while a live untagged node reaches every agent
    Given two untagged stable nodes "a" and "b", where "b" is archived
    When the memory for agent "anyone" is selected
    Then only "a" is selected

  @test:scripts/tests/agent-memory.test.ts::archived_entries_are_retained_but_injected_nowhere::the_ordering_holds_through_the_READER,_for_both_front-matter_spellings
  Scenario: The reader understands both the bare and the quoted archived spelling
    Given a scratch memory directory with untagged nodes "bare" marked archived true, "quoted" marked archived "true", and "live" without the flag
    When the memory nodes are read
    Then exactly "bare" and "quoted" are archived
    And all three have no references
    And the memory for agent "anyone" is only "live"

  @test:scripts/tests/agent-memory.test.ts::archived_entries_are_retained_but_injected_nowhere::a_spelling_the_reader_does_not_understand_is_REFUSED,_not_silently_dropped
  Scenario: An archived value the reader does not understand is refused with an error naming it
    Given a scratch memory directory with node "typo" marked archived "probably"
    When the memory nodes are read
    Then the read throws an error mentioning "archived", "probably" and "typo.md"

  @test:scripts/tests/agent-memory.test.ts::archived_entries_are_retained_but_injected_nowhere::every_YAML_boolean_spelling_of_archived_is_understood,_in_both_cases
  Scenario: Every YAML boolean spelling of archived is understood in any case
    Given nodes marked archived "true", "True", "TRUE", "yes", "Yes", "on" and quoted "true"
    And nodes marked archived "false", "False", "FALSE", "no", "No" and "off"
    When the memory nodes are read
    Then exactly the nodes with a true spelling are archived
    And the memory for agent "anyone" is exactly the nodes with a false spelling

  @test:scripts/tests/agent-memory.test.ts::the_budget_check_sees_a_TRUNCATED_entry,_not_just_a_late_heading::a_region_ending_past_the_budget_names_the_last_entry
  Scenario: A region ending past the budget names its last entry as truncated
    Given a "## TRAP — a thing" heading followed by 250 filler lines and the end marker
    When the entries past the budget are measured
    Then one entry is reported
    And it names "a thing" and says "truncated"

  @test:scripts/tests/agent-memory.test.ts::the_budget_check_sees_a_TRUNCATED_entry,_not_just_a_late_heading::a_region_ending_inside_the_budget_is_silent
  Scenario: A region ending inside the budget reports nothing
    Given a "## TRAP — a thing" heading followed by 10 filler lines and the end marker
    When the entries past the budget are measured
    Then nothing is reported

  @test:scripts/tests/agent-memory.test.ts::the_budget_check_sees_a_TRUNCATED_entry,_not_just_a_late_heading::a_heading_past_the_budget_still_wins_—_it_is_the_more_specific_report
  Scenario: A heading past the budget is reported as dropped, not truncated
    Given 210 filler lines, then "## TRAP — late one" and the end marker
    When the entries past the budget are measured
    Then the first report names "late one"
    And it does not say "truncated"

  @test:scripts/tests/agent-memory.test.ts::the_dropped-entry_gate::nothing_dropped_is_not_a_failure
  Scenario: Nothing dropped yields no failure report
    When the dropped-entry report is built from no agents
    Then it is null

  @test:scripts/tests/agent-memory.test.ts::the_dropped-entry_gate::a_long_file_whose_overflow_is_only_the_session_log_is_not_a_failure
  Scenario: An agent whose file is long but drops no entry yields no failure report
    When the dropped-entry report is built for "platform-boundary-guard" with no dropped entries
    Then it is null

  @test:scripts/tests/agent-memory.test.ts::the_dropped-entry_gate::a_dropped_entry_is_named,_counted,_and_given_a_way_out
  Scenario: A dropped entry is named, counted and given a remedy
    When the dropped-entry report is built for "platform-boundary-guard" with entries "TRAP — a" and "TRAP — b" dropped
    Then it says "platform-boundary-guard: 2 dropped"
    And it lists "TRAP — a; TRAP — b"
    And it suggests "archived: true"
    And it says "Do not fix this by letting the last entry fall off the end"

  @test:scripts/tests/agent-memory.test.ts::the_dropped-entry_gate::every_affected_agent_gets_its_own_row
  Scenario: Each agent with dropped entries gets its own row
    When the dropped-entry report is built for agents "one" and "two", each with one dropped entry
    Then it says "one: 1 dropped" and "two: 1 dropped"

  @test:scripts/tests/agent-memory.test.ts::Antigravity_workspace_rule_(bean_fkqa)::rebaseRuleLinks_rebases_../skills/_links_to_../../cat-harness/skills/
  Scenario: Rule links into ../skills/ are rebased to ../../cat-harness/skills/
    When a link to "../skills/conduct/skill.md" is rebased for the Antigravity rule
    Then it points to "../../cat-harness/skills/conduct/skill.md" and the rest of the text is unchanged

  @test:scripts/tests/agent-memory.test.ts::Antigravity_workspace_rule_(bean_fkqa)::renderAntigravityRule_groups_live_nodes_by_agent_and_skips_archived_nodes
  Scenario: The Antigravity rule groups live nodes by agent and leaves archived nodes out
    Given a stable node for "agent-one", a trap node for "agent-two", an untagged baseline node and an archived stable node for "agent-one"
    When the Antigravity rule is rendered with a 50000-byte budget
    Then nothing is dropped
    And the body has sections "## agent-one", "## agent-two" and "## repo-wide" with each node's labelled heading
    And it does not mention "node-archived"

  @test:scripts/tests/agent-memory.test.ts::Antigravity_workspace_rule_(bean_fkqa)::renderAntigravityRule_budget_enforcement_drops_lowest-priority_nodes_(baseline_first)
  Scenario: Over its budget the Antigravity rule drops the baseline node first
    Given a stable, a trap and a baseline node for "agent-one", each with a long comment
    When the Antigravity rule is rendered with a 600-byte budget
    Then at least one node is dropped, and the first dropped is the baseline "b1"
    And the template spliced with the body is at most 600 bytes

  @test:scripts/tests/agent-memory.test.ts::Antigravity_workspace_rule_(bean_fkqa)::syncAntigravityRule_writes_and_reports_state_cleanly
  Scenario: Syncing the Antigravity rule reports written, unchanged and no-markers
    Given a scratch rule path and one stable node
    When the rule is synced with writing on
    Then the state is "written" with 1 entry and the file exists
    And a second sync without writing reports "unchanged"
    And after the file is overwritten with "no markers", a sync reports "no-markers"

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::AGENT_MEMORY_TARGETS_declares_all_active_targets_with_explicit_budgets
  Scenario: The agent memory targets are all declared, with explicit budgets
    Then the target ids are "claude-agent-memory", "antigravity-skill", "antigravity-rule", "agents-md", "gemini-agent", "codex-agent", "cursor-agent" and "copilot-agent" in that order
    And "claude-agent-memory" has a budget in lines of the Claude memory line budget
    And "antigravity-skill", "antigravity-rule" and "agents-md" each have a budget in bytes of their own byte budget constant

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::repoWideMemory_selects_only_live_nodes_with_no_agent_reference
  Scenario: Repo-wide memory is the live nodes with no agent reference
    Given an untagged node "repo-1", a node "repo-skill-ref" referencing only a skill, a node tagged for an agent and an archived untagged node
    When the repo-wide memory is selected
    Then it is "repo-1" and "repo-skill-ref"

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::lowestPriorityFirst_orders_baseline_->_trap_->_stable,_oldest_createdAt_first
  Scenario: Lowest priority first orders baseline, then trap, then stable, oldest first within a label
    Given stable "s-old", traps "t-new" and "t-old", and baselines "b-new" and "b-old" with differing creation dates
    When they are ordered lowest priority first
    Then the order is "b-old", "b-new", "t-old", "t-new", "s-old"

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::renderAntigravitySkillWithBudget_enforces_byte_budget_and_reports_dropped_nodes
  Scenario: The Antigravity skill keeps within its byte budget and reports the baseline dropped first
    Given a stable, a trap and a baseline node for "agent-one", each with a long comment
    When the Antigravity skill is rendered for "agent-one" with a 900-byte budget
    Then at least one node is dropped, the first being "b1"
    And the rendered size is at most 900 bytes

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::droppedTargetNodesReport_returns_null_when_empty_and_names_dropped_nodes_per_target
  Scenario: The dropped-node report is null when nothing is dropped and names each dropped node per target
    When the report is built from no targets, or from "AGENTS.md" with nothing dropped
    Then it is null
    And when baseline "b1" is dropped from "AGENTS.md" with a 32768-byte budget
    Then the report says "AGENTS.md (budget 32768 bytes): 1 dropped"
    And it lists "[BASELINE] b1 (summary for b1)"
    And it says "never silent truncation"

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::rebaseAgentsMdLinks_rebases_../skills/_links_to_cat-harness/skills/
  Scenario: AGENTS.md links into ../skills/ are rebased to cat-harness/skills/
    When a link to "../skills/conduct/conduct-core/agent-memory.md" is rebased for AGENTS.md
    Then it points to "cat-harness/skills/conduct/conduct-core/agent-memory.md"

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::spliceAgentsMdRegion_supports_both_cat-harness:agent-memory_and_folio:memory_markers
  Scenario: The AGENTS.md region is spliced between either marker pair and refused without markers
    Given an AGENTS.md with the cat-harness agent-memory markers around "old" and a footer
    When the region is spliced with "### STABLE — fact"
    Then the result holds the new text and the footer but not "old"
    And splicing an empty body leaves the two markers adjacent
    And a file with the folio memory markers is spliced too
    And a file without markers is refused

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::renderAgentsMdSection_renders_only_repo-wide_live_nodes_and_drops_lowest-priority_over_budget
  Scenario: The AGENTS.md section renders only live repo-wide nodes and drops the lowest priority over budget
    Given untagged stable, trap and baseline nodes, a node tagged for an agent and an archived untagged node
    When the section is rendered with a 32768-byte budget
    Then nothing is dropped and 3 entries are rendered with their labelled headings
    And the stable node's skill link is rebased to "cat-harness/skills/conduct/skill.md"
    And neither the agent-tagged nor the archived node appears
    And with a 450-byte budget the first dropped is "rw-baseline" and the size is at most 450 bytes

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::syncAgentsMd_handles_missing,_no-markers,_written,_and_unchanged_states
  Scenario: Syncing AGENTS.md reports missing, no-markers, written and unchanged
    Given a scratch directory and one untagged stable node
    When AGENTS.md is synced while the file does not exist
    Then the state is "missing" and no file is created
    And with a file without markers the state is "no-markers"
    And with a file holding the markers the first sync is "written" with 1 entry and nothing dropped
    And a second sync without writing is "unchanged" with 1 entry

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::per-repo_memory_scope_and_link_rebasing_inside_cat-harness_(bean_t5zb)
  Scenario: Inside cat-harness the memory directory is its own and links are rebased within the repository
    Given the cat-harness root
    Then its memory directories are only its own "memory" directory
    And a skills link is rebased to "../../skills/..." for the rule, "skills/..." for AGENTS.md and "../../../skills/..." for a per-agent file

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::rebaseAgentFileLinks_points_an_index_root's_per-agent_files_into_cat-harness
  Scenario: At an index root, per-agent file links point into cat-harness and external links are left alone
    Given a scratch directory as the root
    When a text with a "../skills/a/b.md" link and an "https://e.org/skills/" link is rebased for a per-agent file
    Then the first becomes "../../../cat-harness/skills/a/b.md" and the external link is unchanged

  @test:scripts/tests/agent-memory.test.ts::Repo-wide_AGENTS.md_section_and_per-target_budgets_(bean_31ni)::mounted_layers_are_never_written_into;_stale_committed_memory_surfaces_are_reported_naming_the_layer_(bean_bx4c)
  Scenario: A mounted layer is never written into, and its stale committed memory is reported naming the layer
    Given a scratch index root that mounts "mounted-layer" through its config and lock
    And the mounted layer has a memory node for agent "watcher", a stale MEMORY.md and a stale Antigravity rule
    Then the mounted directory is recognised as mounted and the index root is not
    When agent memory runs at the index root without check mode
    Then the index root's Antigravity rule is written and holds "mounted lesson summary"
    And the mounted layer's MEMORY.md and rule are byte-for-byte unchanged, and no ".agents/skills" or ".gemini" is created in it
    And the run is not ok, with at least one stale mounted surface
    And every mounted finding names "mounted-layer" and says "not rewritten"
