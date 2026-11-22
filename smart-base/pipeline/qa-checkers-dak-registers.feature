Feature: Loading the dak QA-checker contribution registers its content types
  Requiring qa-checkers-dak.ts in a fresh process registers the dak and sushi
  content types in the platform's default registry.

  @test:smart-base/pipeline/qa-checkers-dak-registers.test.ts::qa-checkers-dak.ts::registersDakAndSushiContentTypes
  Scenario: registers dak and sushi in the default registry when the contributions loader requires it
    Given a fresh bun process that requires qa-checkers-dak.ts and then the platform index
    When it prints whether the default content types registry has "dak" and "sushi"
    Then the last line it prints is "true true"
