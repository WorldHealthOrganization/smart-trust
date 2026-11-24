# Specifies pipelinePlugin and usePipelinePluginRegistry
# (pipeline/pipeline-plugins.ts) in the running checkout.
Feature: The running checkout fills every pipeline-plugin slot

  @test:test/coordinator/pipeline-plugins-sci-checkout.test.ts::this_repository::the_running_checkout_fills_every_slot,_loaded_lazily_from_the_running_folio
  Scenario: Every pipeline-plugin kind resolves from the running checkout
    Given no registry override
    When the plugin for each pipeline-plugin kind is asked for
    Then none throws
