Feature: init — the steps the declarations name, in four states

  Background:
    Given a fake instance "demo" of repository someone/demo that needs "base" and declares a present "skills" directory and an absent "gone" directory, optionally with a Pages workflow and a sibling "base" checkout

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::parsesOwnerRepo
  Scenario: owner/repo from either form
    Then "litlfred/bootstrap" gives owner litlfred and repo bootstrap
    And "https://github.com/litlfred/bootstrap.git" gives the same
    And nothing gives nothing

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::checksDirectoriesNeedsReadme
  Scenario: declared directories, needs and the README are checked, not assumed
    When init's steps are computed offline in a dry run for the instance without a workflow or base
    Then declaration is done
    And directory:skills is done and directory:gone is not-done
    And needs:base is not-done
    And readme is done
    And site:workflow is not-done

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::workflowPublisherMustCheckOut
  Scenario: site:workflow — a publisher in the TOOLSET counts only when it checks out that instance
    Given a toolset whose only workflow checks out someone/other and pushes gh-pages
    Then no Pages workflow is found for someone/demo
    When the toolset gains publish-demo.yml checking out someone/demo
    Then the Pages workflow found is "the toolset's .github/workflows/publish-demo.yml, publishing someone/demo"
    And with no owner/repo none is found

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::neededHarnessStepsStated
  Scenario: a needed harness's own instructions are STATED, never done
    When init's steps are computed offline in a dry run for the instance with base beside it
    Then needs:base is done
    And instructions:base is stated

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::noGhPagesUndetermined
  Scenario: no gh: Pages is could-not-determine, with the one manual step — never done, never silent
    When init's steps are computed offline in a dry run for the instance with a workflow
    Then site:enabled is could-not-determine
    And its action is the enable-Pages-by-hand step for someone/demo, which names https://github.com/someone/demo/settings/pages
    And site:live is could-not-determine

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::ghPagesBranchNeverCreated
  Scenario: site:branch: gh-pages must exist before Pages can be on — and init never creates it on the remote
    Given a signed-in gh whose Pages lookup answers 404 and which fails the test if asked to enable Pages
    And git reports no gh-pages branch
    When init's steps are computed for the instance with a workflow
    Then site:branch is not-done, with an action that mentions "--orphan gh-pages"
    And site:enabled is not-done
    And site:branch comes before site:enabled

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::branchWithoutGitUndetermined
  Scenario: site:branch without git is could-not-determine
    When init's steps are computed offline in a dry run for the instance with a workflow
    Then site:branch is could-not-determine

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::enablesPagesThenRechecks
  Scenario: with a signed-in gh, gh-pages present and Pages off, it enables Pages serving gh-pages, then checks again
    Given a signed-in gh whose Pages lookup answers 404 until Pages is enabled, and serves gh-pages at / afterwards
    And git reports a gh-pages branch, and the site answers 404
    When init's steps are computed for the instance with a workflow
    Then site:enabled is done and was performed
    And gh was called to POST repos/someone/demo/pages with source branch gh-pages and path /
    And site:live is not-done

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::dryRunEnablesNothing
  Scenario: --dry-run never enables anything
    Given a signed-in gh that fails the test if asked to enable Pages, and a gh-pages branch present
    When init's steps are computed in a dry run
    Then site:enabled is not-done

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::exitStatusRanking
  Scenario: exit status: not-done outranks could-not-determine, which is never 0
    Then the exit status of one done step is 0
    And of one could-not-determine step is 3
    And of a could-not-determine step with a not-done step is 1

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::httpStatusClassified
  Scenario: an HTTP answer: 404 is not there; 403, 407, 5xx and silence are about the way here
    Then 200 and 301 are done
    And 404 is not-done
    And 403, 407, 503 and no answer are could-not-determine

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::the_PRIMARY_step:_JSON_Schema_and_JSON-LD_at_their_IRIs::primaryStepAfterDeclaration
  Scenario: comes right after the declaration, before any directory, README or site step
    Given a git-initialised instance "kg" at version 0.1.0 with iriBase "https://o.github.io/kg/" and one schema whose $id is under its v0 address
    When init's steps are computed offline in a dry run
    Then the first three steps are declaration, schemas:staged and schemas:published
    And schemas:staged is done
    And schemas:published is could-not-determine

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::the_PRIMARY_step:_JSON_Schema_and_JSON-LD_at_their_IRIs::primaryStepHttpVerdicts
  Scenario: a 404 is not published; a proxy's 403 could not be determined; 200 is done
    Given the same "kg" instance
    When every address answers 404, schemas:published is not-done
    When every address answers 403, schemas:published is could-not-determine
    When every address answers 200, schemas:published is done

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::the_PRIMARY_step:_JSON_Schema_and_JSON-LD_at_their_IRIs::liveNeedsReadmePage
  Scenario: site:live asks the README page too: a root answering over a missing README.html is not done
    Given the same "kg" instance, with every address answering 200 except README.html, which answers 404
    When init's steps are computed in a dry run
    Then site:live is not-done
    And its detail says "README.html answered 404"

  @test:scripts/init.test.ts::init_—_the_steps_the_declarations_name,_in_four_states::the_PRIMARY_step:_JSON_Schema_and_JSON-LD_at_their_IRIs::live403Undetermined
  Scenario: site:live: a 403 is could-not-determine, not not-done
    Given the same "kg" instance, with every address answering 403
    When init's steps are computed in a dry run
    Then site:live is could-not-determine
