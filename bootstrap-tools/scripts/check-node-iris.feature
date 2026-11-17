Feature: check-node-iris — every published file's identifier is its own path under the release address

  Background:
    Given the base "https://example.org/kg/" and the release address "https://example.org/kg/1.2.3/"

  @test:scripts/check-node-iris.test.ts::check-node-iris::ownPathIdentifierPasses
  Scenario: an identifier that is its file's path passes; so does the path without its extension
    Given a schema whose $id is its own path, a JSON-LD file whose @id is its path without the extension, and one whose @id is its path with a fragment
    When the node identifiers are checked
    Then there are no findings

  @test:scripts/check-node-iris.test.ts::check-node-iris::slashVocabularyNamesDirectory
  Scenario: a slash vocabulary names its directory: `processes/ns.jsonld` may say `processes/ns/` (#1378)
    Given processes/ns.jsonld whose @id ends "processes/ns/"
    When the node identifiers are checked
    Then there are no findings
    Given processes/ns.jsonld whose @id ends "processes/other/"
    When the node identifiers are checked
    Then there is 1 finding

  @test:scripts/check-node-iris.test.ts::check-node-iris::otherPathIdentifierFails
  Scenario: an identifier naming another path fails — the discussion-schema defect
    Given schemas/discussion.input.schema.json whose $id names skills/discussion/input.schema.json
    When the node identifiers are checked
    Then the one finding says it names `skills/discussion/input.schema.json`, but the file sits at `schemas/discussion.input.schema.json`

  @test:scripts/check-node-iris.test.ts::check-node-iris::otherReleaseFails
  Scenario: an identifier at another release of the same base fails; one outside the base is not this gate's
    Given a.json with an $id under release 0.9.0 of the base
    And b.json with an $id on another host
    When the node identifiers are checked
    Then only a.json is reported

  @test:scripts/check-node-iris.test.ts::check-node-iris::fullVersionOfMajorFails
  Scenario: a full version of the declared major is another release: it FAILS (the bootstrap-tools#39 tolerance is gone)
    Given the release addresses for version "1.4.0", whose agent address is the base followed by "v1/"
    And a schema whose $id is under "1.2.3/"
    When the node identifiers are checked against that release
    Then the schema is reported

  @test:scripts/check-node-iris.test.ts::check-node-iris::onlyTopLevelIdCounts
  Scenario: only a document's own top-level identifier counts
    Then an object whose $id is only nested has no own identifier
    And an array holding an object with @id has no own identifier
    And an object with a top-level @id "x" has the own identifier "x"
