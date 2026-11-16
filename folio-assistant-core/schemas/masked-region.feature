Feature: masked regions on a bitstream

  @test:schemas/masked-region.test.ts::maskedRegions::acceptsRegionInsideRaster
  Scenario: accepts a region inside the declared raster, with a reason
    When a bitstream with one region inside its raster and a reason is checked
    Then there is no refusal

  @test:schemas/masked-region.test.ts::maskedRegions::acceptsNoMask
  Scenario: accepts a bitstream that masks nothing — absent is the normal case
    When a bitstream with no masked regions is checked
    Then there is no refusal

  @test:schemas/masked-region.test.ts::maskedRegions::refusesRegionPastRaster
  Scenario: refuses a region running past the raster's width or height
    When regions running past the width and past the height are checked
    Then each is refused as outside the declared 300x212

  @test:schemas/masked-region.test.ts::maskedRegions::refusesRegionWithoutReason
  Scenario: refuses a region with no reason
    When a region without a reason is checked
    Then it is refused

  @test:schemas/masked-region.test.ts::maskedRegions::refusesZeroArea
  Scenario: refuses a region of zero or negative area
    When regions of zero width and of negative height are checked
    Then each is refused for want of a positive area

  @test:schemas/masked-region.test.ts::maskedRegions::refusesEmptyList
  Scenario: refuses an empty list — absent and empty are different claims
    When an empty list of masked regions is checked
    Then it is refused

  @test:schemas/masked-region.test.ts::maskedRegions::refusesMaskWithoutDimensions
  Scenario: refuses a mask on a bitstream that declares no pixel dimensions
    When a mask on a bitstream with no pixel dimensions is checked
    Then it is refused naming pixelWidth
