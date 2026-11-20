# What scripts/agent-memory-vendors.ts does: render the Claude agent's prompt and memory as per-agent files for Gemini CLI, Codex,
# Cursor and Copilot, within each host's budget, and keep those files in sync without touching hand-written ones.
# Each Scenario names the test that executes it.
Feature: Agent memory files for other agent hosts

  @test:scripts/tests/agent-memory-vendors.test.ts::tool_translation::Gemini_and_Copilot_names_are_mapped,_and_a_tool_with_no_equivalent_is_left_out
  Scenario: Tool names are mapped for Gemini and Copilot, and a tool with no equivalent is left out
    Given an agent with tools "Read", "Grep", "Glob", "Bash" and "ToolSearch"
    When its tools are translated for Gemini
    Then they are "read_file", "read_many_files", "grep_search", "glob", "list_directory" and "run_shell_command"
    And translated for Copilot they are "read", "search" and "execute"

  @test:scripts/tests/agent-memory-vendors.test.ts::tool_translation::readonly_means_no_file-writing_tool,_and_an_absent_tools_list_is_not_readonly
  Scenario: An agent is readonly when it has no file-writing tool, and an absent tools list is not readonly
    Then the tools "Read", "Grep", "Glob", "Bash" and "ToolSearch" are readonly
    And "Read" with "Edit" is not readonly
    And an absent tools list is not readonly

  @test:scripts/tests/agent-memory-vendors.test.ts::rendering_per_host::memory_is_ordered_STABLE_first,_links_rebased,_detail_named_from_the_repo_root
  Scenario: Rendered memory puts stable notes first, rebases links and names detail files from the repository root
    Given a trap note "a" and a stable note "b" with detail, both for agent "watcher"
    When the vendor memory is rendered
    Then "STABLE" comes before "TRAP"
    And a note's link to "../skills/a/b.md" becomes "../../cat-harness/skills/a/b.md"
    And the detail is named as ".claude/agent-memory/watcher/detail/b.md"

  @test:scripts/tests/agent-memory-vendors.test.ts::rendering_per_host::no_memory_renders_the_prompt_alone
  Scenario: No memory renders as empty, and the agent file still carries the prompt
    # Gap: the agent file is not checked for the absence of a memory section; only that the prompt text is present.
    When the vendor memory is rendered from no notes
    Then it is the empty string
    And a Gemini agent rendered with that empty memory contains the prompt "Do the thing."

  @test:scripts/tests/agent-memory-vendors.test.ts::rendering_per_host::Gemini_and_Copilot_files_start_with_front_matter_carrying_name_and_description
  Scenario: Gemini and Copilot agent files start with front matter carrying the name and the escaped description
    When the Gemini and the Copilot agent files are rendered with memory
    Then each starts with front matter holding name "watcher" and the quoted description with its inner quotes escaped
    And each contains a "## Memory" section

  @test:scripts/tests/agent-memory-vendors.test.ts::rendering_per_host::Cursor_marks_a_non-writing_agent_readonly
  Scenario: A Cursor agent file marks a non-writing agent readonly
    When the Cursor agent file is rendered for the readonly agent
    Then it contains "readonly: true"
    And for an agent with the "Edit" tool it does not mention readonly

  @test:scripts/tests/agent-memory-vendors.test.ts::rendering_per_host::Codex_TOML_carries_the_three_required_keys_and_round-trips_the_prompt
  Scenario: A Codex TOML file carries name, description and developer instructions that round-trip the prompt
    When the Codex agent file is rendered with memory and read back
    Then its name is "watcher" and its description is the unescaped description
    And its developer instructions are the prompt, a blank line and the memory
    And it does not mention "shell_tool"
    And for an agent with only "Read" it sets "shell_tool = false" under "[features]"

  @test:scripts/tests/agent-memory-vendors.test.ts::rendering_per_host::a_prompt_a_TOML_literal_cannot_hold_falls_back_to_an_escaped_basic_string
  Scenario: A prompt a TOML literal string cannot hold falls back to an escaped basic string
    Then a text containing three single quotes renders as the basic string
    And a text ending in a single quote renders as the basic string
    And a basic string escapes a double quote, a backslash and a newline

  @test:scripts/tests/agent-memory-vendors.test.ts::budgets_drop_lowest_priority_first_and_report_it::within_budget_nothing_is_dropped
  Scenario: Within the budget no memory note is dropped
    Given a stable, a trap and a baseline note
    When the Copilot agent file is rendered
    Then nothing is dropped
    And its size is within the Copilot character budget

  @test:scripts/tests/agent-memory-vendors.test.ts::budgets_drop_lowest_priority_first_and_report_it::over_budget,_baseline_goes_before_trap_before_stable
  Scenario: Over the budget the baseline note goes before the trap before the stable
    Given a stable "s", a trap "t" and a baseline "b" note
    When the Copilot agent file is rendered with a limit one character under its full size
    Then only "b" is dropped and the file is smaller than the full one
    And with a limit of 1 character "b", "t" and "s" are dropped in that order

  @test:scripts/tests/agent-memory-vendors.test.ts::budgets_drop_lowest_priority_first_and_report_it::archived_nodes_are_never_written_and_never_counted_as_dropped
  Scenario: An archived note is never written and never counted as dropped
    Given the three notes plus an archived stable note "old"
    When the Copilot agent file is rendered
    Then it does not contain "summary for old"
    And nothing is dropped

  @test:scripts/tests/agent-memory-vendors.test.ts::syncVendorAgents::writes,_then_reports_unchanged,_skips_an_agent_with_no_definition,_and_only_removes_generated_files
  Scenario: Syncing writes each host's file, then reports unchanged, skips an undefined agent and removes only generated files
    Given a scratch tree with a Claude agent "watcher" whose tools read as "Read" and "Grep", and an agent "ghost" with no definition
    When the vendor agents are synced with writing on
    Then all four host files for "watcher" are written, including "copilot/watcher.agent.md" and a "codex/watcher.toml" holding the note summary
    And every "ghost" result is "no-definition" and no "gemini/ghost.md" is written
    And a second sync without writing reports every "watcher" file unchanged
    And after a further sync a generated "gemini/retired.md" is removed while a hand-written "gemini/mine.md" stays
