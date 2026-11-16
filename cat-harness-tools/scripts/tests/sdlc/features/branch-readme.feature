# scripts/branch-readme.ts (branch:readme) renders each declared branch's
# generated README from its declarations and manifest, and gives a verdict on
# the README a branch holds. Each Scenario names the test that executes it.
Feature: Generated branch READMEs

  @test:scripts/tests/sdlc/branch-readme.test.ts::renderBranchReadme::states_what_a_reader_cannot_recover_from_the_files:_status,_provenance,_writes,_declarer
  Scenario: The README states status, provenance, write rule and declarer
    Given an active, authoritative, tip-keyed manifest seeded from main at a fixed sha
    And the beans branch declared by instance "h" as "The work plan."
    When the README of "cat/h/beans" is rendered
    Then it starts with the generated mark
    And it says "**active** — authoritative"
    And it names the source as main at the sha
    And it says "Never force-pushed"
    And it has a declarer table row for "h", "beans", "beans", "beans", "The work plan."

  @test:scripts/tests/sdlc/branch-readme.test.ts::renderBranchReadme::is_deterministic_—_the_same_sources_render_byte-identical_text
  Scenario: The same sources render byte-identical text
    Given one declaration and one manifest
    When the README is rendered twice
    Then the two renderings are identical

  @test:scripts/tests/sdlc/branch-readme.test.ts::renderBranchReadme::a_commit-keyed_branch_with_no_manifest_is_described_as_derived,_not_as_unknown
  Scenario: A commit-keyed branch with no manifest is described as derived
    Given a commit-keyed "qa" declaration and no manifest
    When the README of "cat/h/qa-reports" is rendered
    Then it says "QA results branch"
    And it says "Derived and regenerable"

  @test:scripts/tests/sdlc/branch-readme.test.ts::verdictFor::a_README_equal_to_its_rendering_is_CURRENT
  Scenario: A README equal to its rendering is current
    Given a branch whose README.md is exactly the rendering of its declaration and manifest
    When its verdict is taken
    Then the verdict is "current"

  @test:scripts/tests/sdlc/branch-readme.test.ts::verdictFor::an_absent_or_hand-written_README_is_STALE,_and_says_which
  Scenario: An absent or hand-written README is stale and says which
    Given a branch with a valid manifest
    When its verdict is taken with no README.md
    Then it is "stale" with reason "README.md is absent"
    And with a README.md of "# b" it is "stale" with reason "README.md is hand-written"

  @test:scripts/tests/sdlc/branch-readme.test.ts::verdictFor::a_manifest_that_is_not_state-manifest/v1_is_UNKNOWN_—_a_README_is_never_rendered_from_a_guess
  Scenario: A manifest that is not state-manifest/v1 makes the verdict unknown
    Given a branch whose manifest has a source sha that is not a plain sha
    When its verdict is taken
    Then it is "unknown"
    And the reason mentions "source.sha"

  @test:scripts/tests/sdlc/branch-readme.test.ts::verdictFor::an_unreachable_branch_is_UNKNOWN,_never_stale
  Scenario: An unreachable branch is unknown, never stale
    Given a reader that fails the whole branch with "ls-remote failed"
    When its verdict is taken
    Then it is "unknown"

  @test:scripts/tests/sdlc/branch-readme.test.ts::verdictFor::a_family_and_a_Tool-owned_branch_are_set_aside_by_name,_not_checked
  Scenario: A family and a Tool-owned branch are set aside, not checked
    Given a family declaration for "cat/x/" and a route-keyed declaration owned by the Tool "gh-pages"
    When their verdicts are taken over an empty reader
    Then the family's verdict is "family"
    And the Tool-owned branch's verdict is "tool"
