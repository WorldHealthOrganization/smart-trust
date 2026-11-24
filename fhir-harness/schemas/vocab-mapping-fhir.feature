Feature: Vocabulary mappings to and from FHIR ConceptMap, in R4 and R5

  @test:schemas/vocab-mapping-fhir.test.ts::the_fixtures_are_the_published_examples,_unmodified::fixtureShaMatches[${String(file).replace(/\s+/g,_"_")}]
  Scenario Outline: <file>
    Given the fixture file <file> recorded in provenance.json
    Then its sha256 equals the recorded sha256

    Examples:
      | file |
      | r4/ConceptMap-101.json |
      | r4/ConceptMap-example2.json |
      | r5/ConceptMap-101.json |
      | r5/ConceptMap-example2.json |

  @test:schemas/vocab-mapping-fhir.test.ts::π_∘_ι_=_id_on_published_ConceptMaps::conceptMapRoundTrips[${String(file).replace(/\s+/g,_"_")}]
  Scenario Outline: <file> (<release>)
    Given the published ConceptMap <file>
    Then its release is detected as <release>
    When it is read into a vocab mapping
    Then the mapping validates
    When the mapping is written back as a <release> ConceptMap
    Then nothing is lost and it equals the original
    And no mapping key is carried as an extra, and only descriptive keys are metadata

    Examples:
      | file | release |
      | r4/ConceptMap-example2.json | R4 |
      | r4/ConceptMap-101.json | R4 |
      | r5/ConceptMap-example2.json | R5 |
      | r5/ConceptMap-101.json | R5 |

  @test:schemas/vocab-mapping-fhir.test.ts::π_∘_ι_=_id_on_published_ConceptMaps::fixturesExerciseDependsOnUnmapped
  Scenario: the fixtures exercise dependsOn, product and unmapped in both releases
    Given the R4 and R5 example2 ConceptMaps read as vocab mappings
    Then each has a target with dependsOn and a group with unmapped
    And the R4 one has a target with an equivalence
    And the R5 one has additional attributes

  @test:schemas/vocab-mapping-fhir.test.ts::π_∘_ι_=_id_on_published_ConceptMaps::constructedR5MapRoundTrips
  Scenario: a constructed R5 map using what the examples do not: noMap, fixed unmapped, valueSet, target.property
    Given a constructed R5 ConceptMap with noMap, a value set element, target properties, dependsOn, product and a fixed unmapped
    When it is read as R5
    Then the first group's source version is "2.0"
    When it is written back as R5
    Then nothing is lost and it equals the original

  @test:schemas/vocab-mapping-fhir.test.ts::crossing_releases_is_a_conversion,_and_says_so::r4AsR5ReportsEquivalences
  Scenario: an R4 map produced as R5 reports each equivalence R5 cannot say
    Given the R4 example2 ConceptMap read as R4
    When it is written as R5
    Then one converted equivalence loss is reported for each target whose equivalence R5 cannot say

  @test:schemas/vocab-mapping-fhir.test.ts::crossing_releases_is_a_conversion,_and_says_so::r5NoMapAsR4Reported
  Scenario: an R5 noMap produced as R4 is written the R4 way, and reported
    Given an R5 ConceptMap element with noMap
    When it is written as R4
    Then the element's target is the equivalence "unmatched"
    And the only loss is "converted:noMap"

  @test:schemas/vocab-mapping-fhir.test.ts::π_on_what_a_ConceptMap_cannot_say_reports_it,_never_silently::schemeLossesReported
  Scenario: the derived title, the flag and the JSON key are each a reported loss
    Given a vocab mapping scheme with a title, a flag and a JSON key
    When it is written as an R5 ConceptMap
    Then the losses are "dropped:authority", "dropped:key" and "dropped:transform"
    And the groups target the SKOS and Dublin Core namespaces and "label" maps to "title" as equivalent

  @test:schemas/vocab-mapping-fhir.test.ts::π_on_what_a_ConceptMap_cannot_say_reports_it,_never_silently::onlyR5ElementPaths
  Scenario: what π produces uses only element paths R5 defines
    Given the scheme and the R5 fixtures as vocab mappings
    When each is written as an R5 ConceptMap
    Then it uses no element path R5 does not define

  @test:schemas/vocab-mapping-fhir.test.ts::π_on_what_a_ConceptMap_cannot_say_reports_it,_never_silently::declaredTablesProduceValidR5
  Scenario: every declared vocab-mapping table produces a valid R5 ConceptMap
    Given every vocab-mapping table this harness declares
    Then there is at least one
    When each is written as an R5 ConceptMap with the standard and own prefixes
    Then it uses no element path R5 does not define

  @test:schemas/vocab-mapping-fhir.test.ts::the_whole_published_example_corpus::corpusRoundTrips
  Scenario: every ConceptMap round-trips
    Given the whole published example corpus, when present
    Then it has at least one ConceptMap
    And every ConceptMap round-trips with no losses and equals the original
