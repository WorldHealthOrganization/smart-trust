# stage-local: the parts that decide what is built and where it goes.
# Each Scenario names the test that executes it.
Feature: Local staging decisions

  @test:scripts/tests/stage-local.test.ts::stage-local::reads_the_staging_workflow's_inputs_from_the_folio's_own_file,_with_the_workflow's_defaults
  Scenario: The staging workflow's inputs are read with defaults
    Given a workflow calling folio-staging.yml with build_command, site_dir, folio_dir and platform_dir
    Then those inputs are read, with publish_branch defaulting to "gh-pages"
    And a file without a build_command gives no inputs
    And a doubled single quote in a quoted value reads as one

  @test:scripts/tests/stage-local.test.ts::stage-local::the_slug_follows_the_workflow's_rule_and_refuses_one_that_names_no_single_path_segment
  Scenario: The branch slug follows the workflow's rule
    Then "claude/exciting-ptolemy-se2d2a" slugs to "claude-exciting-ptolemy-se2d2a"
    And "feat//a b" slugs to "feat-a-b"
    And "..", "/" and "" have no slug

  @test:scripts/tests/stage-local.test.ts::stage-local::a_build_that_wrote_only_data_files_is_no_site_(bean_oisv)
  Scenario: A build that wrote only data files is no site
    Then a missing directory built nothing
    And a directory with only a JSON file and an empty folder built nothing
    And once it holds index.html it built something

  @test:scripts/tests/stage-local.test.ts::stage-local::owner/repo_from_a_GitHub_remote,_including_a_proxied_one
  Scenario: owner/repo is read from a GitHub remote
    Then HTTPS, SSH and dotted-name GitHub remotes give their owner/repo
    And a local proxy URL gives none

  @test:scripts/tests/stage-local.test.ts::stage-local::a_content_layer's_tool_is_found_in_whichever_platform_instance_carries_it,_never_named
  Scenario: A tool is found in whichever platform instance carries it
    Given a platform directory where only b-content holds schemas/changeset.ts
    Then schemas/changeset.ts is found in b-content
    And a path no instance holds, or a missing platform, gives nothing

  @test:scripts/tests/stage-local.test.ts::stage-local::an_Artifact_bundle_keeps_the_whole_site_when_it_fits,_and_otherwise_drops_the_busiest_top-level_directories_first
  Scenario: An Artifact bundle keeps what fits and drops the busiest directory
    Then a small site is bundled whole with index.html as the page and nothing dropped
    And a site with 3000 files under en drops en first and keeps the rest within the file limit
    And a site with no index.html throws "no index.html"

  @test:scripts/tests/stage-local.test.ts::stage-local::the_platform_assets_a_page_loads_from_the_platform's_published_site_are_found,_and_its_page_links_are_not
  Scenario: Platform assets a page loads are found, not its links
    Given a page with the rail root, a platform stylesheet and script, a platform page link and a CDN script
    Then the platform root and the css/navbar.css and js/navbar.js assets are found
    And a page without the rail gives none

  @test:scripts/tests/stage-local.test.ts::stage-local:_agent-run_is_what_the_repository_declares_(owner,_2026-10-14,_Q7)::declared:_site.agentRun_true_in_the_repository's_own_index.config.json
  Scenario: Agent-run is declared in the index config
    Given index.config.json with site.agentRun true
    Then the repository is agent-run
    And the line says "yes, declared in index.config.json" and "never dispatch"

  @test:scripts/tests/stage-local.test.ts::stage-local:_agent-run_is_what_the_repository_declares_(owner,_2026-10-14,_Q7)::not_declared:_no_index,_no_flag,_or_false,_each_said_as_what_it_is
  Scenario: Not agent-run, each reason named
    Then no index is "absent", no flag is "not-declared" and false is "declared-false"
    And the line for no index says "no index.config.json"

  @test:scripts/tests/stage-local.test.ts::stage-local:_agent-run_is_what_the_repository_declares_(owner,_2026-10-14,_Q7)::an_index_that_cannot_be_read_is_UNKNOWN,_never_'not_agent-run'
  Scenario: An unreadable index is unknown
    Given an index.config.json that is not valid JSON
    Then agent-run is "unreadable" and the line says "unknown"

  @test:scripts/tests/stage-local.test.ts::previewBase::a_PR_stacked_on_another_branch_is_reviewed_against_that_branch,_not_main
  Scenario: A stacked PR previews against its base branch
    Then with a PR base claude/dth-pc-scaffold the preview base is that branch

  @test:scripts/tests/stage-local.test.ts::previewBase::--base_wins_over_the_PR's_base
  Scenario: --base wins over the PR base
    Then with --base release and a PR base the preview base is release

  @test:scripts/tests/stage-local.test.ts::previewBase::no_PR:_the_default_branch,_then_main
  Scenario: With no PR, the default branch, then main
    Then with only a default branch trunk the preview base is trunk
    And with an empty PR base and no default it is main
