# The turn-reporting skill must name which host rendered a staging preview
# rather than assume GitHub Pages (folio-assistant-1lfx), checked against
# turn-reporting.md and a host-resolution sketch. Each Scenario names the test that executes it.
Feature: Reporting the staging host

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::turn-reporting_staging_host_requirements_(folio-assistant-1lfx)::turn-reporting.md_exists
  Scenario: The turn-reporting skill file exists
    Given the declared skill directories
    When the turn-reporting skill's markdown file is located
    Then the file exists

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::turn-reporting_staging_host_requirements_(folio-assistant-1lfx)::explicitly_requires_stating_the_host_surface_for_staging/review
  Scenario: turn-reporting.md requires stating the host surface of a staging review
    Given the text of turn-reporting.md
    Then it says to "explicitly state which host rendered it"
    And it names "GitHub Pages", "local server" and "chat discussion only"

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::turn-reporting_staging_host_requirements_(folio-assistant-1lfx)::connects_to_deployment-awareness_discipline
  Scenario: turn-reporting.md points to the deployment-awareness discipline
    Given the text of turn-reporting.md
    Then it mentions "deployment-awareness"

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::turn-reporting_staging_host_requirements_(folio-assistant-1lfx)::forbids_assuming_github.io_or_composing_URL_from_git_remote
  Scenario: turn-reporting.md forbids assuming github.io or building a URL from a git remote
    Given the text of turn-reporting.md
    Then it says "Never assume `github.io` or compose a URL from a git remote"
    And it mentions a "private repository"

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::turn-reporting_staging_host_requirements_(folio-assistant-1lfx)::includes_the_third_state:_'could_not_determine'_with_repo-relative_paths
  Scenario: turn-reporting.md includes the "could not determine" state with repo-relative paths
    Given the text of turn-reporting.md
    Then it mentions "could not determine"
    And it mentions "repo-relative"

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::staging_review_host_resolution_discipline::resolves_GitHub_Pages_when_the_declaration_says_github-pages
  Scenario: A declaration naming github-pages resolves to GitHub Pages
    Given a layer whose declaration sets publication.host to "github-pages"
    When its publication host is resolved
    Then the host is "github-pages"

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::staging_review_host_resolution_discipline::resolves_local_server_when_the_declaration_says_local-server
  Scenario: A declaration naming local-server resolves to the local server
    Given a layer whose declaration sets publication.host to "local-server"
    When its publication host is resolved
    Then the host is "local-server"

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::staging_review_host_resolution_discipline::resolves_`none`_(publishes_nowhere,_e.g._chat-only_review)_without_guessing_a_web_host
  Scenario: A declaration naming none resolves to none, not to a guessed web host
    Given a layer whose declaration sets publication.host to "none"
    When its publication host is resolved
    Then the host is "none"
    And it is not "github-pages"

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::staging_review_host_resolution_discipline::third_state:_an_undeclared_or_unknown_host_resolves_to_undefined,_never_github-pages
  Scenario: An undeclared or unknown host is the third state, never GitHub Pages
    Given a layer whose declaration names a github.com repository but no publication host
    And a layer whose declaration sets publication.host to "owner.github.io"
    And a directory with no declaration at all
    When each one's publication host is resolved
    Then every answer is undefined

  @test:scripts/tests/sdlc/staging-host-reporting.test.ts::staging_review_host_resolution_discipline::does_not_compose_github.io_from_repo_remote_when_pagesBaseUrl_is_absent_in_deploy_facts
  Scenario: Deploy facts with no host build a staging preview with no moved-from address
    # Gap: only checks movedFrom is undefined; no github.io URL composition is inspected
    Given deploy facts for slug "claude-my-branch" with no Pages base URL
    When a staging preview node is created from them
    Then the node has no movedFrom
