Feature: The IG site publisher waits for the workflow that seeds its AST cache

  @test:scripts/ig-publisher.test.ts::the_IG_publisher's_after::declaresAstRefreshAsSeeder
  Scenario: the IG publisher declares ig-ast-refresh.yml as what seeds its site
    Then the IG publisher's after is exactly "ig-ast-refresh.yml"
    And it is still a valid site publisher declaration

  @test:scripts/ig-publisher.test.ts::the_IG_publisher's_after::publishWaitsForTemplateRefresh
  Scenario: a repository with the templates and no site.publishAfter waits for its refresh
    Given a repository whose workflows are this layer's ig-ast-refresh.yml and site-publish.yml templates
    And an index.config.json that declares no site.publishAfter
    When the site publish works out what to wait for
    Then it waits for ig-ast-refresh.yml and not for site-publish.yml
    And the reason names ig-ast-refresh.yml

  @test:scripts/ig-publisher.test.ts::the_template_refresh's_push_trigger::refreshRunsOnPushAddingIt
  Scenario: the push that adds the refresh caller runs it
    Given the ig-ast-refresh.yml template
    Then it runs on a push to main that changes .github/workflows/ig-ast-refresh.yml
    And on one that changes sushi-config.yaml, ig.ini or input/
