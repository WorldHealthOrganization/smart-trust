Feature: terminology-lookup resolves a slot's term rung by rung
  A query is resolved first in the target guide's vocabulary, then in
  smart-base's generic code lists, then in external standards, and otherwise
  yields a local candidate or a could-not-determine.

  @test:smart-base/scripts/terminology-lookup.test.ts::terminology-lookup_(bean_folio-assistant-4nfs)::rung1ResolvesPersonaFromTargetGuide
  Scenario: Rung 1: resolves persona from target guide vocabulary first
    When persona "data-steward" is looked up with the DTH NPC vocabulary
    Then the selected rung is "rung-1-target-guide" with an exact match
    And the first match's code is "data-steward" and there is no candidate to mint

  @test:smart-base/scripts/terminology-lookup.test.ts::terminology-lookup_(bean_folio-assistant-4nfs)::rung2FallsBackToGenericPersona
  Scenario: Rung 2: falls back to smart-base generic DAK.Persona.* when not in target guide
    When persona "DAK.Persona.DataManager" is looked up with the DTH NPC vocabulary
    Then the selected rung is "rung-2-smart-base" with an exact match
    And the first match's code is "DAK.Persona.DataManager"

  @test:smart-base/scripts/terminology-lookup.test.ts::terminology-lookup_(bean_folio-assistant-4nfs)::rung2ResolvesDomainAndGrade
  Scenario: Rung 2: resolves guideline-domain SKOS concepts and GRADE code lists
    When domain "health-system-strengthening" is looked up
    Then the selected rung is "rung-2-smart-base" with an exact match in scheme "guideline-domain"
    When recommendation-strength "conditional" is looked up
    Then the selected rung is "rung-2-smart-base" with an exact match of code "conditional"

  @test:smart-base/scripts/terminology-lookup.test.ts::terminology-lookup_(bean_folio-assistant-4nfs)::rung3ResolvesExternalStandardCodes
  Scenario: Rung 3: resolves external standard codes (CDHIv2, ISCO08)
    When intervention "2.3.1" is looked up
    Then the selected rung is "rung-3-external-standard" with an exact match in scheme "CDHIv2"
    When persona "2221" is looked up filtered to scheme "ISCO08"
    Then the selected rung is "rung-3-external-standard" with an exact match in scheme "ISCO08"

  @test:smart-base/scripts/terminology-lookup.test.ts::terminology-lookup_(bean_folio-assistant-4nfs)::rung4CandidateOrCouldNotDetermine
  Scenario: Rung 4: returns glossary-terms candidate (status: candidate) for unmatched persona and could-not-determine for unmatched business-process
    When persona "National Regulatory Authority" is looked up with the DTH NPC vocabulary
    Then there is no match, the rung is "rung-4-local-candidate", and the candidate action is "mint-glossary-candidate" with term status "candidate"
    And its warning contains "WARNING persona-glossary-candidate"
    When business-process "NPC-R01" is looked up with the DTH NPC vocabulary
    Then there is no match, the rung is "rung-4-local-candidate", and the candidate action and status are "could-not-determine"
    And its warning contains "WARNING process-not-determined"
