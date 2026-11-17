Feature: the drawn schema page — bootstrap/schemas/README.md

  Background:
    Given a sample schema "Thing" with a required id, an optional mode of "a" or "b", required parts of at least one item each needing a number n, a conditional "if mode is a then parts are required", and a Thing term definition

  @test:scripts/bootstrap-schema-page.test.ts::drawing::oneBoxPerObject
  Scenario: one box per object, with required marks and multiplicities
    When the schema page is rendered
    Then it shows id as required [1] string, mode as [0..1] "a" | "b", and parts as required [1..*] Part list
    And it draws an edge for each item of parts to a box holding n as required [1] number

  @test:scripts/bootstrap-schema-page.test.ts::drawing::conditionalStatedInWords
  Scenario: a conditional is stated in words
    When the schema page is rendered
    Then it contains the line: If `mode` is "a", `parts` must be present.

  @test:scripts/bootstrap-schema-page.test.ts::drawing::termRowHasAnchorDrawingSrc
  Scenario: each term is a row with its own anchor, its drawing and its [src]
    When the schema page is rendered
    Then it has a terms table with columns #, Term, Definition, Uses and Defined by
    And row 1 carries an explicit "thing" anchor, the bold term Thing, a link to its drawing, no uses, and a [src] link to its $defs entry

  @test:scripts/bootstrap-schema-page.test.ts::refusals_—_nothing_is_dropped_silently::throwsOnUnstatableRule
  Scenario: a rule shape it cannot state throws
    Given a conditional whose if-clause is a minimum rather than a constant
    When its rules are stated
    Then it throws

  @test:scripts/bootstrap-schema-page.test.ts::refusals_—_nothing_is_dropped_silently::throwsOnObjectWithoutProperties
  Scenario: an object with no properties throws
    Given a schema of type object with no properties
    When the schema page is rendered
    Then it throws

  @test:scripts/bootstrap-schema-page.test.ts::namesAndAnchorsMatchGithub
  Scenario: names and anchors match GitHub's
    Then "KnowledgeGraph" is spaced as "Knowledge Graph"
    And the anchor of "Knowledge Graph declaration" is "knowledge-graph-declaration"

  @test:scripts/bootstrap-schema-page.test.ts::committedPageIsCurrent
  Scenario: the committed page is the one the committed schemas produce
    Given the committed bootstrap/schemas/README.md
    Then it links [src] to each of the discussion input, discussion output, graph, model-registry and requirement schemas
