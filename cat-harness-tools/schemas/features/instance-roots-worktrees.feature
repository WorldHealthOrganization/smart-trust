# Layer discovery in schemas/kg/cat-harness.ts (layerRootsIn, repoRootFor, checkoutRootFor and friends)
# and the repository-level readers that use it, with real git worktrees under .claude/worktrees/ (bean g43f).
# Each Scenario names the test that executes it.
Feature: Layer discovery with git worktrees present

  @test:schemas/instance-roots-worktrees.test.ts::instanceRootsIn_with_git_worktrees_present::the_main_checkout_does_not_see_its_nested_worktrees
  Scenario: The main checkout does not see its nested worktrees
    Given a git checkout declaring "root" and "core", with agent worktrees "agent-a" and "agent-b" under .claude/worktrees/
    When layerRootsIn scans the main checkout
    Then it finds exactly the checkout and its "core" instance
    And no path found lies under .claude

  @test:schemas/instance-roots-worktrees.test.ts::instanceRootsIn_with_git_worktrees_present::a_worktree_sees_its_own_instances_and_nothing_of_its_sibling
  Scenario: A worktree sees its own instances and nothing of its sibling
    Given the agent-b worktree holds an extra "only-in-sibling" instance
    When layerRootsIn scans the agent-a worktree
    Then it finds exactly agent-a and agent-a's "core"

  @test:schemas/instance-roots-worktrees.test.ts::instanceRootsIn_with_git_worktrees_present::the_escape:_scanning_`repoRootFor(<worktree_root>)`_lists_no_sibling_worktree
  Scenario: Scanning the repository root of a worktree's root instance lists no sibling worktree
    When repoRootFor is asked for the agent-a worktree root
    Then it returns the main checkout
    And scanning that finds exactly the checkout and its "core"
    And no path found lies inside .claude/worktrees

  @test:schemas/instance-roots-worktrees.test.ts::instanceRootsIn_with_git_worktrees_present::siblingScopeFor_keeps_the_root_instance_inside_its_own_checkout
  Scenario: siblingScopeFor keeps the root instance inside its own checkout
    When siblingScopeFor is asked for the agent-a worktree
    Then it returns agent-a itself
    And scanning that scope finds nothing from agent-b

  @test:schemas/instance-roots-worktrees.test.ts::instanceRootsIn_with_git_worktrees_present::a_worktree's_`.git`_is_a_FILE_and_marks_it_foreign;_a_declared_submodule_is_not
  Scenario: A worktree is a foreign checkout and a declared submodule is not
    Then isForeignCheckout is true for the agent-b worktree
    And false for the main checkout's "core"
    Given a superproject declaring "super" with a "sub" instance whose .git file points into the superproject and is listed in .gitmodules
    Then the submodule is not foreign
    And layerRootsIn on the superproject finds both "super" and "sub"

  @test:schemas/instance-roots-worktrees.test.ts::sibling_clones_in_a_plain_directory_—_the_separated_layout_(ho66)::every_clone_is_an_instance_when_no_checkout_encloses_them
  Scenario: Sibling clones in a plain directory are all instances
    Given a plain directory holding two separately git-initialised clones "lower" and "upper"
    When layerRootsIn scans the plain directory
    Then it finds both "lower" and "upper"
    And siblingScopeFor of "upper" is "upper" itself

  @test:schemas/instance-roots-worktrees.test.ts::sibling_clones_in_a_plain_directory_—_the_separated_layout_(ho66)::inside_a_checkout,_a_clone_is_still_foreign
  Scenario: Inside a checkout, a nested clone is still foreign
    When layerRootsIn scans the main checkout's .claude/worktrees directory
    Then it finds no instances

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::THIS_checkout_—_the_main_one_or_a_nested_agent_worktree_—_answers_itself
  Scenario: This checkout, main or a nested worktree, is its own checkout root
    Given the checkout git reports as holding this layer
    Then checkoutRootFor of that checkout returns itself
    And checkoutRootFor of this layer returns the same checkout

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::the_root_instance_of_a_worktree,_of_the_main_checkout,_and_a_nested_instance
  Scenario: checkoutRootFor answers the enclosing checkout for root and nested instances
    Then checkoutRootFor of agent-a is agent-a
    And of the main checkout is the main checkout
    And of agent-a's "core" is agent-a
    And of the main checkout's "core" is the main checkout

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::a_declared_submodule's_repository_is_its_superproject;_a_non-git_tree_keeps_`dirname`
  Scenario: A declared submodule's checkout is its superproject, and a non-git tree falls back to repoRootFor
    Given a superproject with a .git directory and a declared submodule "sub"
    Then checkoutRootFor of the submodule is the superproject
    Given a plain non-git directory with an "inst" subdirectory
    Then checkoutRootFor of "inst" equals repoRootFor of "inst"

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::a_submodule_whose_superproject_holds_no_`.git`_is_REPORTED,_not_guessed
  Scenario: A submodule whose superproject holds no .git is reported, not guessed
    Given a declared submodule whose superproject has no .git
    When checkoutRootFor is asked for the submodule
    Then it throws "cannot determine the checkout"

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::rootForScope:_a_`scope:_"repository"`_path_on_the_root_instance_resolves_inside_it
  Scenario: A repository-scoped path on a root instance resolves inside it
    Then rootForScope of agent-a with scope "repository" is agent-a
    And rootForScope of agent-a's "core" with scope "repository" is agent-a

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::pages-bootstrap_reads_the_worktree's_own_`.github/workflows`
  Scenario: pages-bootstrap reads the worktree's own workflows
    Given the committed .github/workflows/pages.yml uses actions/deploy-pages
    When findPublishWorkflows reads the agent-a worktree
    Then it returns ["pages.yml"]

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::known-skills_never_reads_`.claude/skills`_from_outside_the_checkout
  Scenario: known-skills never reads .claude/skills from outside the checkout
    Given a "leak" skill seeded under .claude/worktrees/.claude/skills of the main checkout
    When skillMdDirs reads the agent-a worktree
    Then no directory found mentions "leak"
    And every directory skillMdDirs finds for agent-a's "core" lies inside agent-a

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::the_root_instance_reads_its_own_`.claude/skills`,_and_a_loader-stub_group_is_not_a_group_of_skills_(g43f)
  Scenario: The root instance reads its own skills, and a loader-stub group is not a group of skills
    Given agent-a's .claude/skills holds "real" with a named skill file and "stub-only" with only a SKILL.md
    When skillMdDirs reads agent-a
    Then it includes ".claude/skills/real"
    And it does not include ".claude/skills/stub-only"

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::check-retired-front-matter_sweeps_only_inside_the_worktree
  Scenario: check-retired-front-matter sweeps only inside the worktree
    When the retired front-matter scan runs on agent-a
    Then its roots include agent-a's .claude/skills
    And every root lies inside agent-a

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::check-subgraph-coverage_recognises_the_worktree's_root_instance_AS_the_root
  Scenario: check-subgraph-coverage treats the worktree's root instance as the root
    When auditInstance runs on agent-a with its default repository root
    Then it does not throw
    And its findings equal those with agent-a given explicitly as the repository root

  @test:schemas/instance-roots-worktrees.test.ts::checkoutRootFor_—_repository-level_reads_stay_inside_the_checkout_(g43f)::schema-graph_relativises_against_the_worktree,_never_`.claude/worktrees/`
  Scenario: schema-graph makes module paths relative to the worktree
    Given agent-a holds schemas/probe.ts exporting an interface
    When readSchemaGraph reads agent-a
    Then a graph is returned
    And its modules include "schemas/probe.ts"
