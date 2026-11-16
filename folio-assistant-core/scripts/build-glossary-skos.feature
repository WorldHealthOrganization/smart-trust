Feature: a paper's glossary written as a SKOS scheme

  @test:scripts/build-glossary-skos.test.ts::paper_glossary_as_SKOS::builderRunsClean
  Scenario: the builder runs clean for both papers
    When the builder runs for the root and the sub-layer papers
    Then both exit 0

  @test:scripts/build-glossary-skos.test.ts::paper_glossary_as_SKOS::writesSchemeIntoGlossaryDir
  Scenario: writes a folio-glossary/v1 scheme into the layer's declared glossary directory
    When the written scheme is read
    Then it is a valid folio-glossary/v1 named paper-alpha with three terms

  @test:scripts/build-glossary-skos.test.ts::paper_glossary_as_SKOS::statusByProvenance
  Scenario: chooses status by provenance
    When the terms of the scheme are read
    Then a term with a defining block is authored with its label, definition, notation and source
    And a term found in prose is a candidate with that sentence
    And a term with no Markdown body could not be extracted, with a reason

  @test:scripts/build-glossary-skos.test.ts::paper_glossary_as_SKOS::appearsInCollect
  Scenario: appears in collect(), in the owning layer's namespace, sub-layer included
    When the glossaries are collected
    Then nothing is invalid
    And paper-alpha appears for rootfolio and subfolio, each in its own namespace
    And the sub-layer's file is under subfolio/glossary

  @test:scripts/build-glossary-skos.test.ts::paper_glossary_as_SKOS::noIriCollision
  Scenario: no IRI collides across schemes and layers
    When every scheme and term IRI is minted
    Then at least ten IRIs, all distinct
    And foo-bar is minted twice, once per layer

  @test:scripts/build-glossary-skos.test.ts::paper_glossary_as_SKOS::glossaryJsonShapeKept
  Scenario: keeps glossary.json's shape: no field a downstream --check would see as drift
    When the paper's glossary.json is read
    Then its keys and its entries' keys are unchanged

  @test:scripts/build-glossary-skos.test.ts::paper_glossary_as_SKOS::checkPassesCurrentFailsStale
  Scenario: --check passes on a current scheme and fails on a stale one
    When --check runs on a current scheme and on an edited one
    Then it passes on the current one
    And it fails on the stale one saying it is out of date

  @test:scripts/build-glossary-skos.test.ts::paper_glossary_as_SKOS::refusesTakenSchemeId
  Scenario: refuses a scheme id another document in the directory already holds
    Given another document in the glossary directory with id paper-alpha
    When --check runs
    Then it fails saying the scheme id is already taken

  @test:scripts/build-glossary-skos.test.ts::helpers::localIdLowercases
  Scenario: localId lowercases and keeps only id characters
    When local ids are made from "Foo Bar" and "--x_y.z"
    Then they are foo-bar and x_y.z

  @test:scripts/build-glossary-skos.test.ts::helpers::definingParagraphFindsDefterm
  Scenario: definingParagraph finds the :defterm by explicit id or by label
    When the defining paragraph is looked for by id, by label and in a refterm
    Then by id it gives the paragraph text, by label the label
    And a refterm is not a definition

  @test:scripts/build-glossary-skos.test.ts::an_instance_with_no_glossary_directory::noGlossaryDirStillWrites
  Scenario: still writes glossary.json and passes --check, reporting the scheme as not written
    Given a layer that declares no glossary directory
    When the builder runs and then runs with --check
    Then it exits 0 saying the SKOS scheme was not written
    And --check exits 0
