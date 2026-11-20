Feature: The DTH terminology findings page
  The DTH term findings are authored in dth-term-alternatives.json; every quote
  must match what it cites, no conflicting term is dropped, and the committed
  page is generated from them.

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::everyVerifiableQuoteMatchesSource
  Scenario: every quote matches its source, except one citing a file built at publish that is not built here
    Given every quote in the findings that is not unverifiable here
    Then none has a quote problem

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::absentBuiltAtPublishQuoteNotChecked
  Scenario: a quote citing a built-at-publish file that is absent is not checked, and says so
    Given a quote citing smart-base/fhir-artifact-index/index.json under a root where it does not exist
    Then it is unverifiable as "built at publish" when that path is listed as built at publish
    And it is not unverifiable when no path is listed
    And its quote problem says "no such file"

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::reportsQuoteNotInSource
  Scenario: a quote that is not in its source is reported
    Given a quote from the findings whose source is held here and which matches
    When its quote is replaced by "An actor is a concrete participant"
    Then its quote problem says "quote not found"

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::matchesAcrossNumberOnlyLineMarkers
  Scenario: matches across the RA draft's number-only line markers
    Given a section with front matter whose text is broken by a line holding only "64"
    Then its section text is "An actor is an abstract information-processing role"

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::listsConflictingTermsWithAlternatives
  Scenario: lists every conflicting candidate term, each with all its alternatives
    When the page is rendered from the findings and the conflicting candidate terms
    Then it has a "####" heading for every conflicting term
    And it contains each definition the term conflicts with

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::everyApproachHasTwoAlternatives
  Scenario: records every approach with at least two alternatives and picks none
    Then every approach in the findings has at least two alternatives

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::coversSfpDthGlossaryAndConflicts
  Scenario: covers the Substandard and Falsified Medical Products DTH (9789240120747-eng) 35 glossary terms, RA conflicts, and internal alternatives
    Then the SFP findings name library entry "9789240120747-eng" with 35 terms and 5 RA conflicts
    And an internal conflict "sfp-f1-substandard" is recorded
    And a figure reproduction cites section "sec-006-how-to-use-this-handbook" of that entry
    And the rendered page has a bold table row for every SFP term

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::oneProposalPerLayerWithArtefacts
  Scenario: one proposal per layer, each naming artefacts that exist
    Then the actor proposals' layers are exactly "F-A", "RA" and "SG"
    And every artefact a proposal names exists

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::onlyFolioAssistantMappingApplied
  Scenario: only the folio-assistant mapping is applied; RA and SG are drafted for the owner, never sent
    Then the proposal statuses are "F-A" applied, "RA" drafted and "SG" drafted

  @test:smart-base/scripts/gen-dth-term-findings.test.ts::DTH_term_findings::committedPageMatchesGenerator
  Scenario: the committed page is what the generator writes
    Then smart-base/findings/dth-terms.md equals the rendered page
