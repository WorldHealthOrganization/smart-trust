Feature: Staging an IG repository locally, the way its publish workflow does

  @test:scripts/stage-local-ig.test.ts::the_IG_publisher_declares_the_workflows_it_publishes_for::detectsIgPublisher
  Scenario: a caller of fhirbuild.yml is an IG; with ghbuild.yml beside it, the Pages one is the build
    Then a caller of fhirbuild.yml is detected as an IG using that workflow
    And with ghbuild.yml beside it, ghbuild.yml is the build
    And the IG publisher's kind is "ig"

  @test:scripts/stage-local-ig.test.ts::stage-local:_an_IG_lands_where_its_workflow's_deploy_step_puts_it::readsDeploySteps
  Scenario: the deploy steps are read, retries ignored
    Given the IG workflow's deploy steps
    Then the candidate deploy is to gh-pages from output into branches/<branch dir>, not cleaned
    And the main deploy is to the root, cleaned except branches and sitepreview
    And the workflow inputs are do_preprocess and deploy, both true

  @test:scripts/stage-local-ig.test.ts::stage-local:_an_IG_lands_where_its_workflow's_deploy_step_puts_it::defaultRootOthersBranches
  Scenario: default branch → the root, kept paths are the action's own and clean-exclude; other branches → branches/<last component>
    When the default branch is targeted
    Then it lands at the root, keeping the action's own paths and the clean-exclude list, with the main commit message
    And a branch's directory is its last path segment
    When another branch is targeted
    Then it lands under branches/feat-x, keeps nothing and uses the candidate message

  @test:scripts/stage-local-ig.test.ts::stage-local:_an_IG_lands_where_its_workflow's_deploy_step_puts_it::refusesRootOrOutsideCandidate
  Scenario: a candidate that would land at the root, or outside it, is refused
    Then a candidate whose target folder is empty is refused for overwriting the root
    And a candidate directory ".." is refused for leaving the publish root
    And a workflow with no candidate deploy is refused for a branch

  @test:scripts/stage-local-ig.test.ts::stage-local:_an_IG_lands_where_its_workflow's_deploy_step_puts_it::mainCleansCandidateAdds
  Scenario: the main deploy cleans the root but keeps branches/ and sitepreview/; a candidate deletes nothing
    Given a publish branch with a branch preview, sitepreview, .git and a stale page
    When the main deploy is composed
    Then the root holds .git, branches, the new index and sitepreview, and the stale page is gone
    And the branch preview is kept
    When a candidate deploy is composed for that branch
    Then it adds branches/feat, keeping its old page and replacing its index

  @test:scripts/stage-local-ig.test.ts::stage-local:_an_IG_lands_where_its_workflow's_deploy_step_puts_it::refusesCleanOverFolioSite
  Scenario: a clean IG deploy at the root is refused on a publish branch that carries a folio's site
    Given a publish branch carrying a folio's staging site
    Then a clean root deploy is refused, naming the folio's site, and the staging site is kept

  @test:scripts/stage-local-ig.test.ts::stage-local:_an_IG_lands_where_its_workflow's_deploy_step_puts_it::refusesOverStampedFolioSite
  Scenario: so is one over the folio site an IG repository's folio-site.yml deployed, known by its build stamp
    Given a publish branch holding a folio site with its build stamp
    Then a clean root deploy is refused, naming folio-build.json, and the stamp is kept

  @test:scripts/stage-local-ig.test.ts::stage-local:_the_IG_build_is_the_workflow's_own_steps,_planned::planEachStepAction
  Scenario: each step is run, run in its image, stood in for, performed here, or skipped with its reason
    When the IG workflow's steps are planned for the default branch
    Then checkout is skipped and Python is set up in a virtual environment
    And finding and commenting on the PR are skipped, each with its reason
    And the preprocessing check runs, and preprocessing runs, decided when reached
    And the publisher image update runs in Docker, the QA upload is skipped and the main deploy is performed
    And the README link commit is skipped, with its reason

  @test:scripts/stage-local-ig.test.ts::stage-local:_the_IG_build_is_the_workflow's_own_steps,_planned::dockerNamedWhenMissing
  Scenario: a run that needs Docker names it when there is no daemon
    Then with no Docker the missing prerequisites name the Docker daemon
    And with everything present nothing is missing

  @test:scripts/stage-local-ig.test.ts::stage-local:_the_IG_build_is_the_workflow's_own_steps,_planned::expressionsAsRunner
  Scenario: expressions read as the runner reads them
    Then boolean comparisons on inputs and env evaluate as the runner does
    And an unset step output compares false, an or-expression gives the first set value and !cancelled() is true
    And a secret is undefined

  @test:scripts/stage-local-ig.test.ts::stage-local:_the_IG_build_is_the_workflow's_own_steps,_planned::envFilesAndDockerArgs
  Scenario: GITHUB_ENV files and docker args are read as the runner writes and splits them
    Then a GITHUB_ENV file with a value holding "=" and a heredoc value is read as the runner writes it
    And docker arguments are split respecting quotes

  @test:scripts/stage-local-ig.test.ts::stage-local_end_to_end:_an_IG_published_to_a_local_origin,_preview_then_main::endToEndPreviewThenMain
  Scenario: runs the workflow's steps, lays the output where its deploy steps say, and pushes with its commit message
    Given an IG repository, a local origin whose gh-pages holds another branch's build and a stale page, and local reusable workflows
    When a feature branch is staged as a dry run
    Then it would publish a preview of 1 changed file and pushes nothing
    When it is staged
    Then the preview is pushed to branches/feat with the candidate message and the build's commit, keeping the other branch and the stale page
    When the default branch is staged
    Then it is pushed to the root with the main message naming the commit
    And the root holds only branches and the index, the preview is kept, and the history still holds the seed commit

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::siteTitleFromSushi
  Scenario: the site's title and description are the IG's own, from sushi-config.yaml
    Then the site's title and description are the IG's from sushi-config
    And without a title the name is used, and without a readable config the repository name

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::harnessedFolioRoute
  Scenario: harnessed, with the steps mounted: the folio route from the AST, scoped to the landing instance
    Given a harnessed checkout with all the steps mounted
    Then the folio site is scoped to the landing instance, titled from the IG, with the AST, source and site steps, and the IG's keep and dropped lists

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::coveragePolicyReachesBuild
  Scenario: the checkout's declared coverage policy reaches the build; absent, none is set (refuse)
    Then a declared coverage policy "report" reaches the build
    And with none declared, none is set

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::bareRouteWithReason
  Scenario: not harnessed, or nothing mounted to build it: the bare IG route, and why
    Then a checkout with no index.config.json takes the bare route, saying why
    And a checkout with no steps mounted takes the bare route, naming the site step

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::partialStepsRefused
  Scenario: some of the required steps but not all: refused, naming the missing ones (mounts pinned apart)
    Then a checkout with some of the required steps is refused, naming the missing one

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::sidecarsOnlyFromLanding
  Scenario: the IG API sidecars run when the LANDING layer provides them, after the AST; another provider is said, not run
    Given the landing layer provides the IG API sidecars
    Then they run after the AST
    Given another layer provides them
    Then they do not run, and a note names the provider

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::indexesAfterAstAndSidecars
  Scenario: the artefact indexes are built at publish, after the AST and the sidecars, when a mounted layer provides the step
    Then with a layer providing the artefact indexes, they run after the AST and the sidecars
    And without one, a note says no artefact index is built

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::drawingsAfterIndexes
  Scenario: the process drawings are built at publish, after the artefact indexes, when a mounted layer provides render:bpmn
    Then the process drawings step is "render:bpmn"
    And with it provided, it runs after the AST and the indexes, and a note says it runs
    And without it, it is not run and a note says no process drawings are built

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::openapiBeforeServing
  Scenario: the OpenAPI pages run when the checkout holds an OpenAPI graph, before the AST's data is served
    Then with an OpenAPI graph and the step provided, the OpenAPI pages run before the site step
    And without an OpenAPI graph only the site step runs
    And with a graph and no step, a note says they are not built

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::igBarFinalStep
  Scenario: the IG's bar runs as a FINAL step, after the platform's own writers, when a mounted layer provides it
    Then with a layer providing the IG bar, it is the final step
    And without one there is no final step and a note says the pages keep no IG bar

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::igPageScanLastFinalStep
  Scenario: the QA report's page scan is the last final step
    Then with layers providing the IG bar and the page scan, the page scan runs after the bar
    And without the page scan a note says the QA report's page scan has no results

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::parityExcusesRuledDrops
  Scenario: the root's parity guard excuses exactly what the owner ruled dropped: the comparisons, schemas/ and the theme's side bar
    Then the dropped list is the comparison directories, schemas and the siteNav feature, each citing its ruling
    And each entry names a directory or a feature, never both
    And siteNav is the only feature excused

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::dropsInWords
  Scenario: the plan says each drop in words
    Then the drops read "comparison-v*/", "schemas/" and "the page feature siteNav"

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::noLandingRefused
  Scenario: harnessed but no landing named: refused, never guessed among the mounts
    Then a harnessed checkout with no landing named is refused, saying site and landing

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::previewsKeptAtRoot
  Scenario: the IG workflow's per-branch previews are kept at the root
    Then the kept paths include "branches" and "ns"
    And only the semantic version directories are versioned roots

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::declaredKeepAdded
  Scenario: the root keeps what the landing instance's site.build.keep declares, besides the IG's own
    When the landing instance declares "ns", "branches" and "0.1.0" kept
    Then the keep list is the IG's own plus "0.1.0", with nothing doubled

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::declaredKeepFromConfig
  Scenario: the declared keep is read from the landing instance's index.config.json entry; none declared is none kept
    Given an index.config.json whose landing instance declares site.build.keep
    Then its keep list is read and an instance declaring none keeps nothing
    Given a keep entry with a slash
    Then reading it throws about site.build.keep

  @test:scripts/stage-local-ig.test.ts::an_IG_repository's_folio_site_(owner,_2026-10-14)::stampIsFolioRootMarker
  Scenario: the stamp the folio route requires is a folio root marker, so a bare IG deploy refuses that root
    Then the IG site stamp is a folio root marker
    Given a publish root holding the stamp
    Then a bare IG root deploy is refused, naming the folio's site

  @test:scripts/stage-local-ig.test.ts::where_the_checkout_holds_the_landing_instance_(lockedMountPath)::mountedInstancePath
  Scenario: a mounted instance: its path in index.lock.json
    Then a mounted instance's path is its path in index.lock.json

  @test:scripts/stage-local-ig.test.ts::where_the_checkout_holds_the_landing_instance_(lockedMountPath)::localInstancePath
  Scenario: a LOCAL instance (the base harness's own repository): its source.local.at, which the lock does not list
    Given a local landing instance and a remote one in the lock
    Then the local instance's path is its source.local.at, the remote one's is its lock path, and an absent one has none

  @test:scripts/stage-local-ig.test.ts::where_the_checkout_holds_the_landing_instance_(lockedMountPath)::localLandingSidecarsRun
  Scenario: so a local landing layer's sidecars are its own, and run
    Given a local landing instance that provides the sidecars
    Then its sidecars run after the AST
