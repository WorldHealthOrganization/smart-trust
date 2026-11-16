# Specifies schemas/process/deployment-resolver.ts (bean v3zw):
# resolveDeployment, which says which placed actors may run each task and
# with which Tool, and reports tasks no placement can run, or whose fit
# cannot be determined, without throwing.
Feature: The deployment resolver says who may run a task and with which Tool

  Background:
    Given the actors "claude" (agent, role authoring-agent), "owner" (person, role owner) and "attestation-service" (system, reach "internet")
    And the Tools github-pr-create and gitlab-mr-create (open-change, need network), git-format-patch (open-change), api-sign (sign, needs network) and lean-build (prove, needs the lean runtime)

  @test:schemas/process/deployment-resolver.test.ts::resolveDeployment::a_connected_agent_may_open_a_change_with_any_of_three_Tools
  Scenario: A connected agent may open a change with any of three Tools
    Given an "internet" deployment placing "claude" with reach "internet"
    When an authoring-agent task needing open-change is resolved
    Then nothing is unrunnable
    And all three open-change Tools fit as "works"

  @test:schemas/process/deployment-resolver.test.ts::resolveDeployment::unknown_reach_does_not_satisfy_a_network_Tool,_but_the_offline_Tool_still_works
  Scenario: Unknown reach fails the network Tools but the offline Tool works
    Given an "internet" deployment placing "claude" with no reach
    When an authoring-agent task needing open-change is resolved
    Then the candidate's reach is "unknown"
    And github-pr-create and gitlab-mr-create fit as "needs-network" while git-format-patch fits as "works"
    And the candidate is runnable

  @test:schemas/process/deployment-resolver.test.ts::resolveDeployment::an_air-gapped_deployment_cannot_sign_through_the_API:_reported,_not_thrown
  Scenario: An air-gapped deployment cannot sign through the API, and says so
    Given an "air-gapped" deployment placing "claude"
    When an authoring-agent task needing sign is resolved
    Then it is reported unrunnable, because no Tool works for "claude: sign"

  @test:schemas/process/deployment-resolver.test.ts::resolveDeployment::a_role_nobody_placed_may_take_is_reported
  Scenario: A role no placement may take is reported
    Given an "internet" deployment placing only "claude"
    When a task for role "owner" by a person is resolved
    Then it is unrunnable because no placement may take the role owner

  @test:schemas/process/deployment-resolver.test.ts::resolveDeployment::a_user_task_is_a_person's,_whatever_role_the_agent_holds
  Scenario: A person's task goes to a person, whatever role the agent holds
    Given an "internet" deployment placing "claude" and "owner"
    When a task with no role, to be done by a person, is resolved
    Then the only candidate is "owner"

  @test:schemas/process/deployment-resolver.test.ts::resolveDeployment::a_role_inherited_through_the_role_graph_counts
  Scenario: A role inherited through the role graph counts
    Given an "internet" deployment placing "claude"
    When a task for role "contributor" is resolved with a role graph where authoring-agent is a contributor
    Then nothing is unrunnable
    And resolved without that role graph, one task is unrunnable

  @test:schemas/process/deployment-resolver.test.ts::resolveDeployment::an_OS_or_runtime_requirement_is_could-not-determine,_never_works
  Scenario: A runtime requirement cannot be determined, and is reported apart
    Given an "internet" deployment placing "claude" with reach "internet"
    When an authoring-agent task needing prove is resolved
    Then lean-build fits as "could-not-determine"
    And nothing is unrunnable
    And the task is reported undetermined, naming "claude: prove (lean-build)"

  @test:schemas/process/deployment-resolver.test.ts::resolveDeployment::a_skill_no_Tool_satisfies_is_judgement_and_holds_nothing_up
  Scenario: A skill no Tool satisfies is judgement and holds nothing up
    Given an "air-gapped" deployment placing "claude"
    When an authoring-agent task needing content-review is resolved
    Then nothing is unrunnable
    And the candidate's judgement is "content-review", with no Tool-backed skills

  @test:schemas/process/deployment-resolver.test.ts::resolveDeployment::one_actor_placed_twice_is_judged_per_placement
  Scenario: One actor placed twice is judged per placement
    Given an "internet" deployment placing "claude" on claude-code with reach "internet" and on antigravity with reach "air-gapped"
    When an authoring-agent task needing sign is resolved
    Then the claude-code candidate is runnable and the antigravity candidate is not
