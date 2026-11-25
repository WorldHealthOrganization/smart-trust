Feature: L1 recommendation candidates
  Normative sentences of a library entry are found mechanically; an agent's
  curation decides them; verbatim and shape gates refuse a bad curation; and
  the result is an L1 3.0 graph.

  Background:
    Given a library entry of two pages: page 1 with an electronic ISBN and licence text, page 2 with a should-sentence, a bulleted best-practice list and a must-sentence

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_mechanical_half::findsNormativeSentencesDecidesNone
  Scenario: finds every normative sentence and decides none
    When candidates are found with no curation
    Then the candidate locations are p1:s2, p2:s1, p2:s2 and p2:s3
    And 4 are undecided and no graph is written

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_mechanical_half::proposesPublicationFromIsbn
  Scenario: proposes the publication from the printed electronic ISBN, and says so
    Then the proposed identifiers are isbn "978-92-4-011619-1"
    And the publication IRI is ".../publication/isbn-9789240116191"
    And a "publication-proposed" warning is given

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_mechanical_half::hintsAndProposesUnsignedExclusion
  Scenario: hints licence text and layout fragments, and proposes — never signs — the licence exclusion
    Then licence text is hinted "licence-or-imprint" and a bullet "layout-fragment"
    And the only proposed exclusion is p1:s2, editorial, for the role l1-extraction-reviewer
    And nothing is counted as excluded

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_curation_gates::writesValidL1Graph
  Scenario: writes a valid L1 3.0 graph, narrowing a joined list to its bullets
    Given a curation excluding p1:s2, making p2:s1 recommendation R1, splitting p2:s2 into R2 and R3 by their bullets, and p2:s3 a remark of R1
    When it is run
    Then the counts are 3 recommendations, 1 remark, 1 excluded and none undecided
    And the graph validates with no errors
    And it has 3 recommendation nodes and a remark, every node derived as "inferred"

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_curation_gates::implementationGuidanceEmitsPractices
  Scenario: implementation guidance emits implementation-practice nodes, not recommendations (ruling 1b)
    Given the curation without the remark, for a publication of type implementation-guidance
    When it is run
    Then the statement class is implementation-practice, with 3 such nodes and no recommendation
    And the graph's context is the l1-library context and it validates
    And a remark of R1 is refused: "remark attaches only to a recommendation"
    And a good-practice statement is refused: "makes no recommendations of its own"

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_curation_gates::validatorRefusesRecommendationInGuidance
  Scenario: the validator refuses a recommendation defined in implementation guidance
    Given the graph written from the good curation, with its publication's type changed to implementation-guidance
    Then the validator reports "makes no recommendations of its own"

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_curation_gates::unsignedExclusionNotAccountedFor
  Scenario: an unsigned exclusion is not accounted for; a signed one is
    When the good curation is run
    Then coverage is 4 normative, 3 captured, 0 excluded and 1 unaccounted, with an "exclusion-unsigned" warning
    When the exclusion is signed off by a person
    Then 100% is accounted for

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_curation_gates::refusesParaphrase
  Scenario: refuses a paraphrase
    Given a curation whose R1 statement adds ", always." to the source sentence
    Then it is refused as "not verbatim"

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_curation_gates::refusesRemarkOfUndeclared
  Scenario: refuses a remark of a recommendation nobody declared
    Given a curation with a remark of R9 and no R9
    Then it is refused: "no recommendation decision declares"

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_curation_gates::refusesUnknownLocationAndReusedKey
  Scenario: refuses a location the entry does not hold, and a reused key
    Given a curation deciding p9:s1 and using key R1 twice
    Then it is refused: "no normative sentence at this location" and "already used"

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_worked_example::workedExampleIsCurrent
  Scenario: who-iris/library/9789240116191-eng is current
    When the candidates script is run with --check over who-iris/library/9789240116191-eng and its committed curation
    Then it says "current — 48 candidates: 22 implementation practices" and exits 0

  @test:smart-base/L1/scripts/l1-recommendation-candidates.test.ts::the_worked_example::workedExampleScenariosCurrent
  Scenario: its scenario candidates are current
    When the scenarios script is run with --check over the worked example's l1.json, vocabulary, generic personas and mapping
    Then it says "current — 22 scenario candidates, 26 warning" and exits 0
