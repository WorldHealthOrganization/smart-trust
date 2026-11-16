Feature: Registering the ig content type from the plugin slots module

  @test:pipeline/plugin-slots.test.ts::plugin-slots.ts::registersIgContentType
  Scenario: registers the ig content type in the default registry when the contributions loader requires it
    Given a fresh bun process that requires plugin-slots.ts and then the default content type registry
    When it asks whether the default registry has an "ig" content type
    Then its stderr has no line mentioning an error
    And the last line it prints is "true"
