# What src/core/agent-host.ts does: detectAgentHosts names the agent hosts running the session from their environment markers.
# Each Scenario names the test that executes it.
Feature: Detecting the agent host from the environment

  @test:scripts/tests/agent-host.test.ts::detectAgentHosts::each_host_by_its_own_marker
  Scenario: Each host is detected by its own environment marker
    When the hosts are detected from an environment holding a single marker
    Then "GEMINI_CLI" gives "gemini-cli"
    And "CODEX_SANDBOX" gives "codex"
    And "CURSOR_AGENT" gives "cursor"
    And "ANTIGRAVITY_AGENT" gives "antigravity"
    And "COPILOT_CLI" gives "copilot-cli"
    And "CLAUDECODE" gives "claude-code"

  @test:scripts/tests/agent-host.test.ts::detectAgentHosts::an_empty_marker_is_not_a_marker;_none_set_is_no_host
  Scenario: An empty marker is no marker, and no marker means no host
    When "GEMINI_CLI" is set to an empty string
    Then no host is detected
    And with an empty environment no host is detected

  @test:scripts/tests/agent-host.test.ts::detectAgentHosts::the_Copilot_coding_agent_only_inside_GitHub_Actions
  Scenario: The Copilot coding agent is detected only inside GitHub Actions
    When only "COPILOT_AGENT_SESSION_ID" is set
    Then no host is detected
    And when "GITHUB_ACTIONS" is also "true", the host is "copilot-agent"

  @test:scripts/tests/agent-host.test.ts::detectAgentHosts::an_unknown_host_that_sets_AI_AGENT_is_named_by_it,_exposing_nothing
  Scenario: An unknown host that sets AI_AGENT is named by its value and exposes no identity
    When "AI_AGENT" is "v0"
    Then the one host has id and name "v0", marker "AI_AGENT", and does not expose identity

  @test:scripts/tests/agent-host.test.ts::detectAgentHosts::several_hosts_when_one_runs_inside_another
  Scenario: Nested hosts are all detected
    When both "CLAUDECODE" and "CURSOR_AGENT" are set
    Then the hosts are "claude-code" and "cursor" in that order
