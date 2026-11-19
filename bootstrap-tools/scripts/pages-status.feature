Feature: pages-status — the push's status and its message

  Background:
    Given a git-initialised instance "demo" at version 1.0.0 with iriBase "https://x.example/demo/", a README, one schema and one skill

  @test:scripts/pages-status.test.ts::pages-status_—_the_push's_status_and_its_message::publicationRootPrecedence
  Scenario: the publication root is --url, else iriBase, else the Pages address
    Then an iriBase without a trailing slash and no --url gives that iriBase with a trailing slash
    And a --url given beside an iriBase wins, with a trailing slash
    And a repository "Owner/repo" alone gives "https://owner.github.io/repo/"
    And nothing gives no root

  @test:scripts/pages-status.test.ts::pages-status_—_the_push's_status_and_its_message::failureOutranksUnknown
  Scenario: a failure outranks an unknown, and an unknown is never a pass
    Then two done steps are pushed
    And done with could-not-determine is could-not-determine
    And could-not-determine with not-done is not-pushed

  @test:scripts/pages-status.test.ts::pages-status_—_the_push's_status_and_its_message::allAnsweringIsPushed
  Scenario: every address answering is pushed, and the message names the commit and the QA
    When the status is taken for commit "1a2b3c4d5e" with every address answering 200
    Then the status is pushed, to target github-pages
    And the documents QA is 1 answering of 1, none missing or unchecked
    And the message starts "pushed 1a2b3c4 to https://x.example/demo/ — QA: staged ok"

  @test:scripts/pages-status.test.ts::pages-status_—_the_push's_status_and_its_message::missingReadmeNotPushed
  Scenario: a root that answers over a README.html that does not is not pushed
    When the status is taken with every address answering 200 except README.html, which answers 404
    Then the status is not-pushed
    And the README QA is not-done with HTTP 404
    And the message contains "README.html 404"

  @test:scripts/pages-status.test.ts::pages-status_—_the_push's_status_and_its_message::http404NotPushed403Unknown
  Scenario: a document answering 404 is not pushed; a 403 could not be determined
    When the status is taken with every .json address answering 404
    Then the status is not-pushed, and the message names the schema's address as missing
    When the status is taken with every address answering 403
    Then the status is could-not-determine

  @test:scripts/pages-status.test.ts::pages-status_—_the_push's_status_and_its_message::subgraphListFiltersDirectories
  Scenario: a subgraph list renders only those directories and the root's files; an unknown id is a problem
    When the subgraphs "skills" and "nope" are selected
    Then "nope" is unknown
    And README.md and skills/s.md are kept, but schemas/a.schema.json is not
    When the site is staged with only the "skills" subgraph
    Then there are no problems, skills/s.md is staged and the schema is not
    When the status is taken for the subgraph "nope" with every address answering 200
    Then the status is not-pushed and the message mentions "--subgraph nope"
