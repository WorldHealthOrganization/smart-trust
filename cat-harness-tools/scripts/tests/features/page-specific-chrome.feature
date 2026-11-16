# Page-specific chrome loads only where it is used, and the QR encoder on first
# use. Each Scenario names the test that executes it, in the grammar
# @test:<file>::<scope>::<name> (skill test-engineer, "Every test has a Gherkin").
Feature: A page loads the chrome it uses

  @test:scripts/tests/page-specific-chrome.test.ts::page-specific_scripts_and_styles::the_work-plan_dashboard's_stylesheet_and_script_are_emitted_only_where_its_container_is
  Scenario: The work-plan dashboard's files are emitted only where its container is
    Given the shared head include
    Then work-plan.css and work-plan.js each sit inside "if content contains 'data-fa-workplan'"

  @test:scripts/tests/page-specific-chrome.test.ts::page-specific_scripts_and_styles::the_process_index's_script_is_emitted_only_where_its_container_is
  Scenario: The process index's script is emitted only where its container is
    Given the shared head include
    Then process-index.js sits inside "if content contains 'data-fa-process-index'"

  @test:scripts/tests/page-specific-chrome.test.ts::page-specific_scripts_and_styles::the_chrome_every_page_needs_is_still_unconditional
  Scenario: The chrome every page needs is still unconditional
    Then docs-ui.js, navbar-row.js, edit-links.js and docs-ui.css sit inside no content condition

  @test:scripts/tests/page-specific-chrome.test.ts::page-specific_scripts_and_styles::the_QR_encoder_is_not_loaded_by_the_head
  Scenario: The head does not load the QR encoder
    Then no script tag in the head names vendor/qrcode

  @test:scripts/tests/page-specific-chrome.test.ts::the_QR_encoder_is_loaded_on_first_use,_once::two_callers_before_it_arrives_share_one_load,_and_both_are_called
  Scenario: Two callers share one load of the encoder
    Given navbar-row.js run against a stub page
    When the row and the tile both ask for the encoder before it arrives
    Then qrcode.js and then qrcode_UTF8.js are added once each, and both callers are called
    And a later caller is called at once with no new script

  @test:scripts/tests/page-specific-chrome.test.ts::the_QR_encoder_is_loaded_on_first_use,_once::a_failed_load_calls_the_failure_callbacks,_and_a_later_call_tries_again
  Scenario: A failed load is reported, and a later call tries again
    When qrcode.js fails to load
    Then the failure callback runs, and the next request adds the script again

  @test:scripts/tests/page-specific-chrome.test.ts::the_QR_encoder_is_loaded_on_first_use,_once::docs-ui.js_always_offers_the_QR_tile_and_asks_the_shared_loader_when_it_opens
  Scenario: docs-ui.js always offers the QR tile
    Then the tile is added with no check for the encoder, and the view asks window.faEnsureQrcode

  @test:scripts/tests/page-specific-chrome.test.ts::the_QR_encoder_is_loaded_on_first_use,_once::print:_the_QR_code_is_not_printed,_so_loading_it_on_demand_leaves_nothing_out_of_a_printout
  Scenario: Loading the encoder on demand leaves nothing out of a printout
    Then the print stylesheet removes the sidebar that holds the QR code
