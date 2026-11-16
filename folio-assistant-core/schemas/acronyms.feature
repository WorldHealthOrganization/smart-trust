Feature: acronyms found in prose and checked against the glossary

  @test:schemas/acronyms.test.ts::isAcronym::capitalsDigitsMixedAreAcronyms
  Scenario: capitals, digits and mixed forms are acronyms
    When isAcronym is asked about WHO, GS1, HL7, eLMIS, OpenHIE, WHODrug, ICD-11, DH&I and GHSC-PSM
    Then each is an acronym

  @test:schemas/acronyms.test.ts::isAcronym::wordsNumeralsHeadingsNotAcronyms
  Scenario: words, names, Roman numerals and shouted headings are not
    When isAcronym is asked about Health, McDonald, II, XIV, A, INTRODUCTION and iPhone
    Then none is an acronym

  @test:schemas/acronyms.test.ts::codes,_plurals_and_words_in_capitals::folioIdsAreCodes
  Scenario: a folio's own ids are codes, not acronyms
    When isCode is asked about folio ids and real acronyms
    Then PC-R-05, PC-BP-01 and MFR001 are codes
    And ICD-11, ITU-T and GS1 are not

  @test:schemas/acronyms.test.ts::codes,_plurals_and_words_in_capitals::pluralCountedUnderSingular
  Scenario: a plural is counted under its singular
    When singular is applied
    Then "GTINs" gives "GTIN" and "FAQs" gives "FAQ"
    And "eLMIS" is left as it is

  @test:schemas/acronyms.test.ts::codes,_plurals_and_words_in_capitals::capitalsWordDroppedWhoKept
  Scenario: a word in capitals is dropped when the text spells it otherwise; WHO is kept
    Given prose that shouts RESOURCES, STEPS, RWANDA and OF but spells them otherwise, and uses WHO
    When acronyms are found
    Then only WHO is found
    And "rwanda" is among the lower-case words

  @test:schemas/acronyms.test.ts::findAcronyms::readsProseOnlyWithLines
  Scenario: reads prose only, with lines
    Given prose with WHO and GS1 on line 1, FHIR in code and HL7 in a link on line 2, and UNICEF on line 3
    When acronyms are found
    Then WHO and GS1 are found on line 1 and UNICEF on line 3, nothing else

  @test:schemas/acronyms.test.ts::expansions::longNameExpansionShortestRun
  Scenario: Long Name (ACR) gives the shortest run starting with the first letter
    Given prose with "United States Agency for International Development (USAID)" and "World Health Organization (WHO)"
    When inline expansions are read
    Then USAID and WHO map to those long names

  @test:schemas/acronyms.test.ts::expansions::abbreviationTableReadAsWritten
  Scenario: an abbreviations table is read as written
    Given an Abbreviations table with FDA and HL7, followed by another table
    When the abbreviation table is read
    Then it holds exactly FDA and HL7 with their definitions as written

  @test:schemas/acronyms.test.ts::the_acronym-in-glossary_checker::mountedGlossaryCounts
  Scenario: a glossary here or in a mounted layer counts
    Given glossaries here and in a mounted layer
    When the visible labels are collected
    Then WHO and HL7 are visible
    And of "WHO HL7 GS1 GS1" only GS1 is missing

  @test:schemas/acronyms.test.ts::the_acronym-in-glossary_checker::warnsOncePerAcronym
  Scenario: warns, once per acronym, at its first line; never fails
    Given prose with acronyms missing from the glossary
    When the acronym-in-glossary checker runs
    Then the result is a warning
    And it reports GS1 at line 1 and UNICEF at line 2, once each

  @test:schemas/acronyms.test.ts::the_acronym-in-glossary_checker::naWithoutProse
  Scenario: n/a without prose
    When the checker runs with no prose
    Then the result is n/a
