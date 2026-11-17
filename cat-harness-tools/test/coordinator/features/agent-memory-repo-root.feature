# Specifies the checkout's agent-memory corpus (the root-declared memory/
# graph) and the files generated from it: per-agent MEMORY.md, the
# Antigravity rule and skills, and the repo-wide AGENTS.md target.
Feature: The memory corpus is valid, routed by agent and role, and its generated files are current

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_corpus::there_are_memory_nodes_to_check_—_otherwise_this_proves_nothing
  Scenario: The corpus has enough memory nodes to check
    Given the memory nodes of the checkout
    When they are read
    Then there are more than 20

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_corpus::every_node_validates,_and_none_is_a_baseline_without_provenance
  Scenario: Every memory node validates, and no baseline lacks its provenance
    Given the memory nodes of the checkout
    When each is parsed with the memory node schema
    Then every parse succeeds
    And no node labelled "baseline" is without "measured"
    And the first node, relabelled "baseline" with its "measured" removed, does not parse

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_corpus::ids_are_unique_—_overlay_resolves_by_id,_so_a_collision_hides_an_entry
  Scenario: Memory node ids are unique
    Given the memory nodes of the checkout
    When their ids are collected
    Then no id occurs twice

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_corpus::a_shared_SUMMARY_is_allowed,_and_the_corpus_really_has_one
  Scenario: At least two nodes share a summary
    Given the memory nodes of the checkout
    When their summaries are collected
    Then there are fewer distinct summaries than nodes

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_corpus::every_agent's_file_is_assembled_and_current
  Scenario: Every agent's generated memory file is current
    Given the agent memory files
    When they are synced without writing
    Then every agent's file is "unchanged"

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_corpus::no_memory_ENTRY_falls_past_the_harness's_200-line_injection_budget
  Scenario: No memory entry falls past the injection budget
    Given the agent memory files
    When they are synced without writing
    Then no agent has an entry that overflows the budget

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_role_axis_discriminates_—_memoryForRoles_is_not_dead_code::every_live_entry_carries_a_lane,_so_untagged_has_no_instances
  Scenario: Every live entry carries a role lane
    Given the memory nodes that are not archived
    When those with no role tag are collected
    Then there are none

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_role_axis_discriminates_—_memoryForRoles_is_not_dead_code::a_CI_lane_sees_the_CI_entries;_another_lane_does_not
  Scenario: The build-pipeline lane sees exactly its tagged entries more than the reviewer lane
    Given the memory nodes of the checkout
    When the memory for the "build-pipeline" role and for the "reviewer" role is selected
    Then the build-pipeline lane gets more entries than the reviewer lane
    And the difference equals the number of nodes tagged "build-pipeline"

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_role_axis_discriminates_—_memoryForRoles_is_not_dead_code::role_tags_do_not_change_what_an_AGENT_is_handed
  Scenario: Changing every entry's role tags does not change what any agent is handed
    Given the memory nodes of the checkout, at least one of which carries a role tag
    When memoryForAgent is asked for each agent over the nodes as they are, with every role tag removed, and with every node tagged "reviewer" alone
    Then each agent is handed the same entry ids all three times

  @test:test/coordinator/agent-memory-repo-root.test.ts::round_trip_—_no_entry_is_lost::every_entry_in_every_generated_file_parses_back_to_a_node
  Scenario: Every entry in every generated memory file parses back to a node
    Given each agent's generated MEMORY.md
    When the file is parsed
    Then it has at least one entry
    And every entry's summary is the summary of a memory node

  @test:test/coordinator/agent-memory-repo-root.test.ts::rendering::entries_come_out_STABLE,_then_TRAP,_then_BASELINE
  Scenario: Rendered entries are ordered STABLE, then TRAP, then BASELINE
    Given the memory nodes of the checkout
    When they are rendered
    Then the headings' kinds appear in the order STABLE, TRAP, BASELINE

  @test:test/coordinator/agent-memory-repo-root.test.ts::archived_entries_are_retained_but_injected_nowhere::the_corpus_has_archived_entries,_and_they_reach_no_agent
  Scenario: Archived entries exist and reach no agent
    Given the memory nodes of the checkout
    When the archived ones are counted and each agent's memory is selected
    Then there is at least one archived node
    And no agent's memory includes an archived node

  @test:test/coordinator/agent-memory-repo-root.test.ts::the_budget_check_sees_a_TRUNCATED_entry,_not_just_a_late_heading::this_repo's_own_generated_files_are_whole
  Scenario: The checkout's generated memory files have no truncated entry
    Given the agent memory files
    When they are synced without writing
    Then every file that exists and has markers has no overflowing entry

  @test:test/coordinator/agent-memory-repo-root.test.ts::Antigravity_workspace_rule_target_(bean_fkqa)::the_Antigravity_agent-memory_rule_file_exists_and_is_current
  Scenario: The Antigravity rule file is current and within budget
    Given the Antigravity agent-memory rule
    When it is synced without writing
    Then it is "unchanged" and drops no entry
    And it has more than 20 entries
    And its size is within the Antigravity rule byte budget

  @test:test/coordinator/agent-memory-repo-root.test.ts::Antigravity_workspace_rule_target_(bean_fkqa)::the_Antigravity_rule_file_has_both_agent_sections_populated
  Scenario: The Antigravity rule file has both agents' sections
    Given the Antigravity rule file
    When it is read
    Then it contains the headings "## ci-health-watcher" and "## platform-boundary-guard"
    And it contains a "### STABLE —" and a "### TRAP —" entry

  @test:test/coordinator/agent-memory-repo-root.test.ts::Antigravity_workspace_rule_target_(bean_fkqa)::every_Antigravity_workspace_skill_is_current_and_within_its_byte_budget
  Scenario: Every Antigravity skill is current and within budget
    Given the Antigravity workspace skills
    When they are synced without writing
    Then every skill is "unchanged" and drops no entry
    And every skill's size is within the Antigravity skill byte budget

  @test:test/coordinator/agent-memory-repo-root.test.ts::Antigravity_workspace_rule_target_(bean_fkqa)::the_repo-wide_AGENTS.md_target_is_gated_and_drops_no_entries
  Scenario: The repo-wide AGENTS.md target drops no entry
    Given the repo-wide AGENTS.md target
    When it is synced without writing
    Then its state is "unchanged" or "no-markers" where the file exists, and "missing" where it does not
    And it drops no entry
    And when it is "unchanged" its size is within the AGENTS.md byte budget
