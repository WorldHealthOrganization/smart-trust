# scripts/check-declared-assets.ts audits an instance's declared assets: each must exist on disk
# and its relative links must resolve, with moves and unmounted directories reported for what they are.
# Each Scenario names the test that executes it.
Feature: Declared assets exist and their links resolve

  @test:scripts/tests/declared-assets.test.ts::this_repository's_own_declarations::both_instances_declare_their_agent_instructions
  Scenario: This layer and bootstrap each declare one agent-instructions asset that exists
    Given this layer's declaration and bootstrap's declaration
    When their agent-instructions assets are listed
    Then each declares exactly one
    And that asset exists on disk

  @test:scripts/tests/declared-assets.test.ts::this_repository's_own_declarations::no_declared_asset_is_missing_and_no_link_is_dead
  Scenario: This layer and bootstrap have no missing asset and no dead link
    Given this layer and bootstrap
    When each instance is audited
    Then neither has any finding

  @test:scripts/tests/declared-assets.test.ts::this_repository's_own_declarations::the_provenance_sits_on_the_file_bootstrap_actually_copies_—_and_that_file_is_RENDERED
  Scenario: The rendered root AGENTS.md quotes bootstrap's and is current
    Given the repository root, bootstrap and this layer
    Then neither bootstrap's nor this layer's "agent-instructions" asset carries a source
    And the repository root declares no assets
    And the rendered root AGENTS.md links to "bootstrap/AGENTS.md"
    And the root index render is current

  @test:scripts/tests/declared-assets.test.ts::this_repository's_own_declarations::every_relative_link_out_of_the_rendered_root_files_resolves
  Scenario: Every relative link in the root's rendered files resolves
    Given the root AGENTS.md, README.md, CLAUDE.md and GEMINI.md
    When their checkable links are resolved against the repository root, ignoring anchors
    Then no link points at a missing path

  @test:scripts/tests/declared-assets.test.ts::the_gate_catches_what_v8gh_measured::a_link_broken_by_a_directory_move_is_a_finding
  Scenario: A link broken by a directory move is a dead-link finding
    Given an instance whose AGENTS.md links to "docs/guides/agent-onboarding.md", which does not exist
    When the instance is audited
    Then the only finding is a "dead-link"

  @test:scripts/tests/declared-assets.test.ts::the_gate_catches_what_v8gh_measured::a_declared_asset_that_is_not_on_disk_is_a_finding,_never_a_skip
  Scenario: A declared asset missing from disk is a finding
    Given an instance declaring the asset "NOPE.md", which is not on disk
    When the instance is audited
    Then the first finding is "missing"

  @test:scripts/tests/declared-assets.test.ts::the_gate_catches_what_v8gh_measured::a_resolving_link_is_not_a_finding
  Scenario: A resolving link is not a finding
    Given an instance whose AGENTS.md links to an existing README.md
    When the instance is audited
    Then there are no findings

  @test:scripts/tests/declared-assets.test.ts::the_gate_catches_what_v8gh_measured::a_link_into_a_declared_directory_this_checkout_does_not_mount_is_not_checked,_not_dead
  Scenario: A link into a declared but unmounted directory is counted as not checked
    Given an instance declaring a "site-docs/" directory that is not on disk
    And a README linking into "site-docs/source/guide/" and to the missing "elsewhere/x.md"
    When the instance is audited
    Then the only finding is a "dead-link" for "elsewhere/x.md"
    And one link is counted as not checked

  @test:scripts/tests/declared-assets.test.ts::the_gate_catches_what_v8gh_measured::a_dead_link_inside_a_declared_directory_that_IS_mounted_is_still_a_finding
  Scenario: A dead link inside a mounted declared directory is a finding
    Given an instance whose declared "site-docs/" directory exists
    And a README linking to the missing "site-docs/missing.md"
    When the instance is audited
    Then the only finding is a "dead-link"

  @test:scripts/tests/declared-assets.test.ts::the_gate_catches_what_v8gh_measured::an_instance_declaring_no_assets_is_clean,_not_an_error
  Scenario: An instance declaring no assets is clean
    Given an instance with an empty assets list
    When the instance is audited
    Then there are no findings

  @test:scripts/tests/declared-assets.test.ts::what_it_will_not_pretend_to_have_checked::external_links_and_anchors_are_NOT_checkable
  Scenario: External links and anchors are not checkable
    Given a set of link targets
    Then "https://example.org", "mailto:a@b.c" and "#section" are not checkable
    And "docs/x.md" and "../up.md" are checkable

  @test:scripts/tests/declared-assets.test.ts::what_it_will_not_pretend_to_have_checked::links_inside_fenced_code_are_not_links
  Scenario: Links inside fenced code are ignored
    Given markdown with a link to "a.md" in prose and a link to "b.md" inside a code fence
    When its links are extracted
    Then only "a.md" is returned

  @test:scripts/tests/declared-assets.test.ts::leadParagraph_reads_headings_the_way_a_reader_does::a_setext_title_and_an_unseparated_ATX_heading_are_not_prose_(smart-trust's_IG_README)
  Scenario: Setext titles and bare ATX headings are skipped when finding the lead paragraph
    Given a README with badges, a setext title, an empty "###" and a "### Publication" heading
    When its lead paragraph is read
    Then it is "This is the guide"

  @test:scripts/tests/declared-assets.test.ts::leadParagraph_reads_headings_the_way_a_reader_does::a_thematic_break_is_not_a_lead_paragraph,_and_an_ATX_h1_still_opens_the_body
  Scenario: A thematic break after an h1 is skipped when finding the lead paragraph
    Given markdown with "# T", a "---" break, then "The lead."
    When its lead paragraph is read
    Then it is "The lead."

  @test:scripts/tests/declared-assets.test.ts::a_declared_move::in_the_window_the_link_is_reported_as_moved
  Scenario: A link into a moved path is reported as moved while the move is in its window
    Given an instance declaring a move from "old" to "new" until 2026-12-31
    And an AGENTS.md linking to "old/x.md", with "new/x.md" on disk
    When it is audited as of 2026-11-05
    Then the only finding is "moved"

  @test:scripts/tests/declared-assets.test.ts::a_declared_move::past_`until`_it_is_a_dead_link_again
  Scenario: A link into a moved path is a dead link once the move's window has passed
    Given an instance declaring a move from "old" to "new" until 2026-11-04
    And an AGENTS.md linking to "old/x.md", with "new/x.md" on disk
    When it is audited as of 2026-11-05
    Then the only finding is "dead-link"
