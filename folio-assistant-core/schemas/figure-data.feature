Feature: the figure-data schemas

  @test:schemas/figure-data.test.ts::figure-data_schemas::diigFigureParsesWrongColourRefused
  Scenario: a DIIG phases figure parses, and a wrong colour does not
    When a DIIG phases figure is validated as is and with a phase coloured "green"
    Then it is accepted, and the wrong colour is refused

  @test:schemas/figure-data.test.ts::figure-data_schemas::adaptationNeedsAdapts
  Scenario: an adaptation needs what it adapts
    When a DIIG phases adaptation is validated with and without what it adapts
    Then it is accepted with adapts, and refused with an empty adapts

  @test:schemas/figure-data.test.ts::figure-data_schemas::smartFigureNeedsThreeBands
  Scenario: a SMART approach figure parses, and needs three bands
    When a SMART approach figure is validated as is and with two bands
    Then it is accepted, and two bands are refused

  @test:schemas/figure-data.test.ts::figure-data_schemas::unknownFieldRefused
  Scenario: an unknown field is refused
    When a DIIG phases figure with an extra field is validated
    Then it is refused
