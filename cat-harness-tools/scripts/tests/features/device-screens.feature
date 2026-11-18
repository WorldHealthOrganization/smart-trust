# Device screens in the journeys viewer (scripts/journeys/ read, present, render, screens and check), over a fixture
# instance with actors, two journeys, a workshop that still names an app to frame, and device-screen nodes.
# Each Scenario names the test that executes it.
Feature: Device screens in the journeys viewer

  @test:scripts/tests/device-screens.test.ts::device_screens:_read,_ordered,_linked::the_reader_finds_the_screens_a_directory_declares
  Scenario: The reader finds the device screens a declared directory holds
    Given a fixture instance declaring a device-screens directory with screens P2, P4-scanner and X1
    When the journey corpus is read
    Then its screens are "P2", "P4-scanner" and "X1" in that order
    And it reports no problems

  @test:scripts/tests/device-screens.test.ts::device_screens:_read,_ordered,_linked::the_nodes_replace_the_framed_app;_ordered_by_the_first_step_they_show
  Scenario: Screen nodes replace the framed app, ordered by the first step they show
    Given the fixture workshop that names an app to frame and teaches steps P2 and P4
    When its presentation is computed
    Then its demo is "screens", not the framed app
    And its screens are "P2" then "P4-scanner"
    And screen P2 shows steps "P2" and "P4"
    And the screens for step P4 are "P2" and "P4-scanner"

  @test:scripts/tests/device-screens.test.ts::device_screens:_read,_ordered,_linked::with_no_node_for_its_steps,_a_workshop_frames_its_app;_with_neither,_it_has_no_demo
  Scenario: Without screen nodes a workshop frames its app, and without either it has no demo
    Given the fixture corpus with its screens removed
    When the workshop's demo screens are computed
    Then the source is "frame" with the framed screen "OLD"
    And for the workshop with its presentation removed, the source is "none" with no screens

  @test:scripts/tests/device-screens.test.ts::device_screens:_read,_ordered,_linked::JV-15:_the_journey_stages_are_pills_in_the_header_band,_labelled_by_step_and_title,_the_current_one_on
  Scenario: The journey stages are pills in the header band with the current one on
    Given the rendered page of screen P4-scanner
    Then a "jp-stagebar" nav follows the page header
    And its P4-scanner pill is marked "is-on" with aria-current "page" and labelled with the code "P4"
    And the stage bar comes before the page's note

  @test:scripts/tests/device-screens.test.ts::device_screens:_read,_ordered,_linked::JV-17:_every_device_has_a_status_bar;_wider_ones_name_the_app_and_its_version_from_the_screen's_client
  Scenario: Every device has a status bar, and a wider one names the client app and its version
    Given the rendered demo pages that draw a device
    Then each holds a "ds-statusbar"
    And a tablet screen whose client is "OHS Facility Client" 2.4.1 at "10:14 AM" gets a status bar naming the client, "v2.4.1" and the time
    And a phone screen's status bar draws a notch
    And a device screen with that client parses with client version "2.4.1"

  @test:scripts/tests/device-screens.test.ts::device_screens:_read,_ordered,_linked::a_screen's_page_draws_the_device,_its_owner,_and_the_moments_it_shows;_no_iframe
  Scenario: A screen's page draws the device, its owner and the moments it shows, with no iframe
    Given the rendered page of screen P4-scanner
    Then it draws a scanner device figure for "P4-scanner"
    And it says "You are looking at what Reem (Nurse) sees at this moment." with no owner chip
    And it links back to the walkthrough step P4 and names "Handheld scanner"
    And it lists "Moments this screen shows" with an expand control
    And it holds no iframe and no unresolved root mark
    And no page is rendered for the framed screen "OLD" or for screen "X1", which no workshop teaches

  @test:scripts/tests/device-screens.test.ts::device_screens:_read,_ordered,_linked::the_step_links_to_each_screen_that_shows_it,_named_for_whose_device_it_is
  Scenario: A walkthrough step links to each screen that shows it, named for whose device it is
    Given the rendered walkthrough page of step P4
    Then it links to the demo page of P4-scanner
    And it offers "See what Reem sees (screen P4-scanner)" and "See what Kamal sees (screen P2)"
    And those links sit in the right column, and the left column holds none

  @test:scripts/tests/device-screens.test.ts::device_screens:_read,_ordered,_linked::the_demo_index_lists_each_screen_with_its_device_and_owner
  Scenario: The demo index lists each screen with its device and owner
    Given the rendered demo index of the workshop
    Then it links "P2/"
    And it shows "Kamal · Phone" and "Reem · Scanner"
    And it does not say "open the app"

  @test:scripts/tests/device-screens.test.ts::avatars::a_persona's_picture_is_copied_once_and_drawn_wherever_the_persona_appears,_from_each_page's_root
  Scenario: A persona's picture is copied once and drawn wherever the persona appears
    Given the fixture persona Kamal with an avatar and Reem without one
    When the journey pages are rendered
    Then "avatars/demo/kamal.webp" is written exactly once
    And the walkthrough page of P4 draws Kamal's picture by a path relative to its own depth, in the persona chip and at the hand-off end
    And the journey page "p4-scanned" draws it from its own depth
    And Reem is drawn as her initial "R" on her colour
    And no page keeps an unresolved root mark

  @test:scripts/tests/device-screens.test.ts::check:journey-refs_over_screens_and_avatars::every_unresolved_reference_is_a_finding
  Scenario: Every unresolved screen or avatar reference is a finding
    Given the fixture corpus
    When check:journey-refs runs
    Then it counts 3 screens
    And it reports the personCard actor "nobody" as no actor
    And it reports the FHIR example "Bundle/kamal-ips" as in no declared fhir-artifact-index
    And it reports step "P9" as no step of journey p2-signed
    And it reports the avatar "scenarios/avatars/missing.webp" of ghost as no file of instance demo
    And nothing is reported about kamal.webp or the p4-scanner screen

  @test:scripts/tests/device-screens.test.ts::drawing_a_screen::a_record_list_takes_its_rows_from_the_example:_the_Composition_aside,_an_allergy_struck_through
  Scenario: A record list takes its rows from its FHIR example
    Given a recordList block over the example "Bundle/ips" holding a Composition, a MedicationStatement and an AllergyIntolerance
    When the block is drawn
    Then it shows "Insulin glargine" with an "active" chip and the code "A10AE04"
    And the allergy "Penicillin" is a struck-through row
    And the Composition is not shown
    And it links the example's page "https://ig.example/Bundle-ips.html"

  @test:scripts/tests/device-screens.test.ts::drawing_a_screen::Inspect_JSON_on_a_QR_code_and_a_record_list_opens_the_page's_drawer_on_that_example,_only_when_the_drawer_has_it
  Scenario: Inspect JSON appears on a QR code and a record list only when the drawer holds the example
    Given a screen with a QR code and a record list over "Bundle/ips" and a QR code over "Bundle/none"
    When its blocks are drawn with only "Bundle/ips" inspectable
    Then the QR code gets an "Inspect JSON" button for "Bundle/ips"
    And the record list gets one for "Bundle/ips"
    And the QR code over "Bundle/none" gets none
    And with no inspectable examples the first QR code gets none

  @test:scripts/tests/device-screens.test.ts::drawing_a_screen::rowsFromExample_reads_a_lone_resource,_and_nothing_from_what_is_not_JSON
  Scenario: Rows are read from a lone resource, and none from text that is not JSON
    Given a lone Immunization resource for "Hep B" on 2025-10-28, lot "TH-4821", status "completed"
    When rows are read from it
    Then there is one syringe row "Hep B" with detail "2025-10-28 · Lot TH-4821" and a neutral "completed" status
    And reading rows from "not json" yields none

  @test:scripts/tests/device-screens.test.ts::drawing_a_screen::text_is_escaped;_a_passcode_hides_its_digits_unless_shown
  Scenario: Text is escaped and a passcode hides its digits unless shown
    Given single blocks drawn on a phone screen
    Then a note "<script>x</script>" is escaped
    And a passcode with digits "4829" does not show them
    And the same passcode marked shown draws each digit
    And a consent not granted says "Not shared"
    And an "emergency" status badge takes the danger tone

  @test:scripts/tests/device-screens.test.ts::drawing_a_screen::a_wide_device_splits_the_side_blocks_into_a_second_column;_a_phone_does_not
  Scenario: A wide device puts side blocks in a second column and a phone does not
    Given a screen with a header, a main note, a side note and actions
    When it is drawn on a tablet
    Then the main and side notes are split into two columns
    And the header comes before the split and the actions after it
    And when drawn on a phone there is no split, the status bar is drawn and the main note comes before the side note

  @test:scripts/tests/device-screens.test.ts::drawing_a_screen::a_screen_with_states_draws_every_state,_the_first_shown,_and_a_switch_that_waits_for_the_script
  Scenario: A screen with states draws every state, the first shown, with a switch hidden until the script runs
    Given a tablet screen "S4" labelled "Valid card" with a "tampered" state labelled "Tampered card"
    When it is drawn
    Then the default state is shown and the tampered state is hidden
    And "VALID SIG" comes before "SIG MISMATCH"
    And there is exactly one status bar
    And its state switch is hidden, with "Valid card" pressed and "Tampered card" not pressed
    And a screen without states gets no switch and no state markup

  @test:scripts/tests/device-screens.test.ts::drawing_a_screen::a_QR_code_is_a_real_one:_finder_patterns_at_three_corners,_the_size_of_a_QR_version
  Scenario: A QR code has finder patterns at three corners and the size of a QR version
    Given the payload "https://example.org/shl#x"
    When its QR matrix is built
    Then its side is 17 plus a multiple of 4
    And finder patterns sit at the top-left, top-right and bottom-left corners
    And its SVG has a viewBox of the side plus 4 and one square per dark module
