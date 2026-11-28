# scripts/gen-skill-commands.ts reconciles the user_invocable skills with the short slash commands in
# .claude/commands/: it writes a pointer command for each declared skill, removes the orphans it generated,
# and reports hand-written and mounted-layer commands without touching them.
# Each Scenario names the test that executes it.
Feature: Slash commands generated from user_invocable skills

  @test:scripts/tests/gen-skill-commands.test.ts::both_directions::a_declared_skill_with_no_command_is_MISSING,_and_writing_fixes_it
  Scenario: A declared skill with no command is missing until the commands are written
    Given a skills package with the user_invocable skill "a" and the non-invocable skill "b"
    When the commands are reconciled
    Then the only finding is "missing" for "a"
    And writing creates only ".claude/commands/a.md"
    And reconciling again finds nothing
    And the written command is marked generated and names "skills/a.md"

  @test:scripts/tests/gen-skill-commands.test.ts::both_directions::a_HAND-WRITTEN_command_with_no_declared_skill_is_UNDECLARED_—_reported,_never_touched
  Scenario: A hand-written command with no declared skill is reported as undeclared and left untouched
    Given no skills and a hand-written command "prepare-merge.md"
    When the commands are reconciled
    Then the only finding is "undeclared" for "prepare-merge"
    And after writing, the hand-written command is byte-for-byte unchanged

  @test:scripts/tests/gen-skill-commands.test.ts::both_directions::a_GENERATED_command_whose_skill_stopped_declaring_itself_is_ORPHANED,_and_removed
  Scenario: A generated command whose skill is no longer user_invocable is orphaned and removed
    Given a generated command for the skill "a"
    And the skill "a" no longer declares user_invocable
    When the commands are reconciled
    Then the only finding is "orphaned" for "a"
    And writing removes ".claude/commands/a.md"

  @test:scripts/tests/gen-skill-commands.test.ts::both_directions::a_generated_command_that_no_longer_matches_is_STALE;_a_hand-written_one_for_a_declared_skill_is_left_alone
  Scenario: A generated command that drifted is stale and refreshed, while a hand-written one is left alone
    Given the declared skills "a" and "b", with a hand-written command for "b"
    And the generated command for "a" edited so it no longer matches
    When the commands are reconciled
    Then the only finding is "stale" for "a"
    And after writing there are no findings
    And the hand-written command for "b" is unchanged

  @test:scripts/tests/gen-skill-commands.test.ts::both_directions::a_command_written_before_the_generator_moved_(bean_70lx)_is_still_generated:_STALE,_and_refreshed
  Scenario: A command generated under the generator's old path is still recognised as generated
    Given a generated command for "a" rewritten to name the generator "cat-harness/scripts/gen-skill-commands.ts" and a moved skill path
    When the commands are reconciled
    Then the old command still counts as generated
    And the only finding is "stale" for "a"
    And after writing there are no findings and the command no longer mentions "moved-away"

  @test:scripts/tests/gen-skill-commands.test.ts::a_command_is_a_pointer,_never_a_copy::the_generated_text_names_the_skill's_path_and_does_not_inline_its_body
  Scenario: A generated command points at the skill instead of copying its body
    Given a user_invocable skill "a" whose body contains "SECRET BODY LINE"
    When its command text is generated
    Then the text names "skills/a.md"
    And it does not contain "SECRET BODY LINE"

  @test:scripts/tests/gen-skill-commands.test.ts::instance_vs_index_scope_(bean_t5zb)::packagesFor_scopes_an_instance_checkout_to_its_own_declared_skills_graph
  Scenario: An instance checkout is scoped to its own skills graph, not the one it needs
    Given an instance "base-inst" with the skill package "base-pkg"
    And an instance "child-inst" that needs "base-inst" and holds the skill package "child-pkg"
    When the skill packages for "child-inst" are resolved
    Then they are only "child-pkg"
    And writing in "child-inst" creates only ".claude/commands/c.md"
    And reconciling "child-inst" finds nothing

  @test:scripts/tests/gen-skill-commands.test.ts::instance_vs_index_scope_(bean_t5zb)::mounted_layers_are_never_written_into;_stale_committed_commands_are_reported_naming_the_layer_(bean_bx4c)
  Scenario: A mounted layer is never written into and its stale commands are reported by layer
    Given an index checkout that mounts the layer "mounted-layer" through its config and lock
    And the layer commits a stale generated command "m.md" for its skill "m"
    Then the layer counts as mounted and the index root does not
    And writing in the mounted layer writes nothing and leaves the stale command unchanged
    When the skill commands are run over the index checkout
    Then the index gets its own ".claude/commands/m.md"
    And the mounted layer's stale command is still unchanged
    And the run is not ok, with one mounted finding
    And that finding names "mounted-layer" and ".claude/commands/m.md" and says it is "not rewritten"

  @test:scripts/tests/gen-skill-commands.test.ts::a_mount_that_leaves_out_an_opt-in_sub-graph_(cat-harness-tools#1754)::pointerTarget_reads_the_skill_path_out_of_a_generated_pointer
  Scenario: The skill path is read out of a generated pointer line
    Given the pointer line "Read [`sdlc/skills/x.md`](../../sdlc/skills/x.md) and follow it."
    When its target is read
    Then it is "sdlc/skills/x.md"
    And text with no link has no target

  @test:scripts/tests/gen-skill-commands.test.ts::a_mount_that_leaves_out_an_opt-in_sub-graph_(cat-harness-tools#1754)::a_command_whose_skill_is_in_an_excluded_sub-graph_is_skipped_—_not_orphaned,_not_removed
  Scenario: A command whose skill lies in a sub-graph the mount leaves out is skipped
    Given a mounted layer whose lock entry excepts "sdlc", which is not on disk
    And the layer commits the command "watch" pointing into "sdlc/skills/sdlc-core/watch.md" and the command "gone" pointing at a missing skill under "skills/core"
    When the layer's commands are reconciled
    Then "watch" is listed as not mounted, with its skill path
    And "gone" is still found "orphaned", while no finding names "watch"
    When the skill commands are run over the index checkout
    Then no mounted finding mentions "watch.md"
    And a line says the mount "leaves out (sdlc)"
    And the layer's "watch.md" still exists

  @test:scripts/tests/gen-skill-commands.test.ts::a_mount_that_leaves_out_an_opt-in_sub-graph_(cat-harness-tools#1754)::without_`except`_in_the_lock_the_same_command_is_still_an_orphan_(the_lock_decides)
  Scenario: Without an except in the lock the same command is an orphan
    Given the same mounted layer with no "except" on its lock entry
    When the layer's commands are reconciled
    Then nothing is listed as not mounted
    And "watch" is found "orphaned"

  @test:scripts/tests/gen-skill-commands.test.ts::a_mount_that_leaves_out_an_opt-in_sub-graph_(cat-harness-tools#1754)::an_unmounted_checkout_never_skips:_its_own_orphan_is_still_removed_by_write()
  Scenario: An unmounted checkout never skips its own orphaned command
    Given an unmounted checkout with no skills and a generated command "watch" pointing at "/nowhere/sdlc/watch.md"
    When its commands are reconciled
    Then nothing is listed as not mounted
    And the only finding is "orphaned"
    When its commands are written
    Then the only file changed is ".claude/commands/watch.md"
    And that command is gone
    And reconciling again finds nothing

  @test:scripts/tests/gen-skill-commands.test.ts::over_this_repository::every_user_invocable_skill_has_a_command_and_every_command_has_a_declared_skill
  Scenario: This repository's skills and commands agree
    Given this repository's checkout
    When its commands are reconciled
    Then there are no findings
    And there are no duplicates
