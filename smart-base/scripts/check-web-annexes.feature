Feature: The web annex checks
  A DAK's web annexes (data dictionaries and swimlane maps) are judged, not
  only typed: their ids, declarations, references into the artefact index,
  annex records and the publication and section they name.

  @test:smart-base/scripts/check-web-annexes.test.ts::the_data_dictionary_is_judged,_not_only_typed::consistentDictionaryNoFinding
  Scenario: a consistent dictionary has no finding
    Given a dictionary with one sheet holding ids "A.1" and "A.2"
    Then judging it finds nothing

  @test:smart-base/scripts/check-web-annexes.test.ts::the_data_dictionary_is_judged,_not_only_typed::idUsedTwiceIsFinding
  Scenario: an id used twice, across sheets, is a finding
    Given a dictionary with two sheets each holding id "A.1"
    Then a finding says '"A.1" is used twice'

  @test:smart-base/scripts/check-web-annexes.test.ts::the_data_dictionary_is_judged,_not_only_typed::emptyIdAndShortRowAreFindings
  Scenario: an empty id and a short row are findings
    Given a dictionary with a row with an empty id and a row with one cell for two columns
    Then a finding says "has no data element id"
    And a finding says "1 cell(s) for 2 column(s)"

  @test:smart-base/scripts/check-web-annexes.test.ts::the_swimlane_declaration_is_unambiguous::laneAliasAndNotPersonaIsFinding
  Scenario: a lane that is both a persona alias and not a persona is a finding
    Given a swimlane map where "HW" is an alias of "Health worker" and also declared not a persona
    Then a finding says '"HW" is declared not a persona'

  @test:smart-base/scripts/check-web-annexes.test.ts::the_swimlane_declaration_is_unambiguous::aliasOfTwoPersonasIsFinding
  Scenario: an alias claimed by two personas is a finding
    Given a swimlane map where personas A and B both claim alias "X"
    Then a finding says '"X" names two personas'

  @test:smart-base/scripts/check-web-annexes.test.ts::the_swimlane_declaration_is_unambiguous::otherKindFileNotJudged
  Scenario: a file of another kind is not judged here
    Given a file whose $schema is "something-else/v1"
    Then judging the file returns nothing

  @test:smart-base/scripts/check-web-annexes.test.ts::what_the_annexes_name_resolves_in_the_instance's_artefact_index::indexCodeSystemsOnly
  Scenario: the index's CodeSystems, and only those
    Given an artefact index with CodeSystem "A" and ValueSet "B"
    Then its code systems are exactly "A"

  @test:smart-base/scripts/check-web-annexes.test.ts::what_the_annexes_name_resolves_in_the_instance's_artefact_index::idUnderListedCodeSystemResolves
  Scenario: a data element id under a listed CodeSystem resolves
    Given a dictionary holding id "A.DE.1" and the index's code systems
    Then judging its references finds nothing

  @test:smart-base/scripts/check-web-annexes.test.ts::what_the_annexes_name_resolves_in_the_instance's_artefact_index::idUnderNoCodeSystemIsFinding
  Scenario: an id under no listed CodeSystem is a finding, and a ValueSet does not count
    Given a dictionary holding ids "B.DE.1" and "Z.DE.2"
    Then judging its references gives two findings
    And the first says '"B.DE.1" belongs to no CodeSystem'

  @test:smart-base/scripts/check-web-annexes.test.ts::what_the_annexes_name_resolves_in_the_instance's_artefact_index::prefixMustEndAtDot
  Scenario: a prefix must end at a dot: AB.DE.1 is not under A
    Given a dictionary holding id "AB.DE.1"
    Then judging its references gives one finding

  @test:smart-base/scripts/check-web-annexes.test.ts::what_the_annexes_name_resolves_in_the_instance's_artefact_index::existingRecordsResolve
  Scenario: records whose files exist and whose columns every sheet has resolve
    Given annex records naming an existing dictionary with columns "data element id" and "label", and an existing page
    Then judging the records finds nothing

  @test:smart-base/scripts/check-web-annexes.test.ts::what_the_annexes_name_resolves_in_the_instance's_artefact_index::missingFileAndColumnAreFindings
  Scenario: a missing file, and a column no sheet has, are findings
    Given annex records naming a missing file "gone.md" and a dictionary with a column "required" no sheet has
    Then a finding says "gone.md, which does not exist"
    And a finding names 'column "required"'

  @test:smart-base/scripts/check-web-annexes.test.ts::what_the_annexes_name_resolves_in_the_instance's_artefact_index::columnsOverNonDictionaryIsFinding
  Scenario: columns over a file that is not a dictionary is a finding, not a crash
    Given an annex record naming columns over a markdown page
    Then a finding says "is not a dak-data-dictionary/v1"

  @test:smart-base/scripts/check-web-annexes.test.ts::an_instance_with_no_artefact_index:_ids_unresolved,_not_failed_(fm9n)::noIndexCountsIdsUnresolved
  Scenario: no index held: no finding, the ids are counted unresolved
    Given a dictionary with ids "A.DE.1" and "A.DE.2" and no artefact index
    Then there are no findings and 2 unresolved ids

  @test:smart-base/scripts/check-web-annexes.test.ts::an_instance_with_no_artefact_index:_ids_unresolved,_not_failed_(fm9n)::heldIndexJudgesIds
  Scenario: an index held: ids are judged against it as before
    Given the same dictionary and an artefact index
    Then with code system "A" there are no findings
    And with only code system "B" there are two findings

  @test:smart-base/scripts/check-web-annexes.test.ts::annex_records_in_either_shape::annexRecordsArrayOrObject
  Scenario: a bare array, and fhir-harness's ig-annexes/v1 object, hold the same records
    Then a bare array of records reads as those records
    And an ig-annexes/v1 object holding them reads as the same records
    And any other object, or null, reads as no records

  @test:smart-base/scripts/check-web-annexes.test.ts::which_publication_and_which_section_a_web_annex_names::sectionRefsIncludeExtendedKind
  Scenario: a kind's sections, and those of the kind it extends
    Given kinds l1 (introduction, annexes), l1-guideline extending l1 (recommendations) and dak (core-data-elements)
    Then the section refs include "dak#core-data-elements", "l1#annexes", "l1-guideline#annexes" and "l1-guideline#recommendations"
    And they do not include "l1#recommendations"

  @test:smart-base/scripts/check-web-annexes.test.ts::which_publication_and_which_section_a_web_annex_names::undeclaredSectionIsFinding
  Scenario: a section no kind declares is a finding
    Given a web annex naming section "dak#nowhere"
    Then a finding names 'section "dak#nowhere"'

  @test:smart-base/scripts/check-web-annexes.test.ts::which_publication_and_which_section_a_web_annex_names::libraryResolvedIrisUnverified
  Scenario: a library entry is resolved; an IRIS handle is said to be unverified, not a finding
    Then a web annex of the held library entry "an-ig/library/the-dak" has no findings and nothing unverified
    And a web annex of "an-ig/library/gone" has a finding saying "no library entry"
    And a web annex of IRIS handle "10665/380303" with its own IRIS record "10665/1" has no findings, and both are listed unverified
