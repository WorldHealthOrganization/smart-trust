Feature: Measuring the dependency edges of an IG's logic layer

  @test:scripts/measure-logic-layer-edges.test.ts::source_readers::readsRuleSetParams
  Scenario: reads a RuleSet's declared parameters
    Then the RuleSet "PlanDefMain" declares the parameters "library" and "version"

  @test:scripts/measure-logic-layer-edges.test.ts::source_readers::readsCqlLibraryNames
  Scenario: reads each CQL file's library name
    Then the CQL files' library names are "ACommon" and "AOneLogic"

  @test:scripts/measure-logic-layer-edges.test.ts::source_readers::resolvesLogicType
  Scenario: resolves a logic type from a dependency-package profile URL, not just a bare type
    Then "AOne" is a PlanDefinition, "AOneMeasure" a Measure and "ACommon" a Library, through their profile URLs
    And the RuleSet "LogicLibrary" has no logic type

  @test:scripts/measure-logic-layer-edges.test.ts::the_export_side::exportCountsLogicOnly
  Scenario: counts only the logic layer, and finds no field able to hold an edge
    When the export side is measured
    Then it counts 5 logic resources: 2 Libraries, 1 PlanDefinition and 1 Measure
    And no exported field could hold a dependency edge

  @test:scripts/measure-logic-layer-edges.test.ts::the_export_side::reconcilesIndexIds
  Scenario: reconciles every index id against a source declaration
    Then every index id matches a source declaration

  @test:scripts/measure-logic-layer-edges.test.ts::fsh-cone_as_merged_—_coverage_and_information_are_different_numbers::coverageAndInformationDiffer
  Scenario: coverage and information are different numbers, and only the second moved
    Given the Library row of the measurement
    Then both Libraries have an out-edge, with a mean out-degree of 2
    And they reach 3 distinct targets: the shared RuleSet and their two CQL bodies

  @test:scripts/measure-logic-layer-edges.test.ts::fsh-cone_as_merged_—_coverage_and_information_are_different_numbers::libraryWithoutIdReachesCql
  Scenario: a Library that omits `Id:` still reaches its CQL body — cause (a), fixed
    Then the Libraries that omit Id still reach the CQL bodies "cql:ACommon" and "cql:AOneLogic"

  @test:scripts/measure-logic-layer-edges.test.ts::fsh-cone_as_merged_—_coverage_and_information_are_different_numbers::planDefinitionReachesLogic
  Scenario: a PlanDefinition reaches its Logic library through the RuleSet — cause (b), fixed
    Then the PlanDefinition has an out-edge, reaching "AOneLogic" and the RuleSet "PlanDefMain"

  @test:scripts/measure-logic-layer-edges.test.ts::fsh-cone_as_merged_—_coverage_and_information_are_different_numbers::measureReachesThroughTwoLevels
  Scenario: a Measure reaches its Logic library through TWO levels of RuleSet
    Then the Measure reaches "AOneLogic" and the RuleSet "MeasureProportion"

  @test:scripts/measure-logic-layer-edges.test.ts::ground_truth_—_after_RuleSet_parameter_substitution::libraryGroundTruth
  Scenario: recovers the Library -> its own CQL body by the name convention
    Then 2 Libraries have a logic edge, to "ACommon" and "AOneLogic"

  @test:scripts/measure-logic-layer-edges.test.ts::ground_truth_—_after_RuleSet_parameter_substitution::planDefinitionGroundTruth
  Scenario: recovers `Canonical({library}Logic)` from inside a parameterised RuleSet
    Then 1 PlanDefinition has a logic edge, to "AOneLogic"

  @test:scripts/measure-logic-layer-edges.test.ts::ground_truth_—_after_RuleSet_parameter_substitution::measureGroundTruth
  Scenario: recovers a canonical written as a string URL, not a Canonical() call
    Then 1 Measure has a logic edge, to "AOneLogic"

  @test:scripts/measure-logic-layer-edges.test.ts::ground_truth_—_after_RuleSet_parameter_substitution::extractionReachesGroundTruth
  Scenario: extraction reaches every logic target ground truth names — the guard, for every type
    Then for every logic type, ground truth names at least one target and every one of them is reached

  @test:scripts/measure-logic-layer-edges.test.ts::report::reportNamesCollapse
  Scenario: names the distinct-target collapse rather than only printing a percentage
    When the report is written
    Then it says no field could hold a dependency edge
    And it says not every distinct target is a shared RuleSet
    And it counts 3 logic-to-logic edges
