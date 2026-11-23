# Specifies schemas/ui/rendered-impact.ts: the rendered-impact contract (bean
# bnjs) — a diff of two built sites, the review list taken from it, a cone
# prediction checked against a measured build, the content pins on each
# rendered file, and the files a measurement says the prediction missed.
Feature: The rendered files a change alters are measured, pinned and checked against the prediction

  Background:
    Given built site "a" with same.html, page.html "old", gone.html, assets/js/search-data.json "{1}" and data/r.json "{}"
    And built site "b" with same.html, page.html "new", new.html, assets/js/search-data.json "{2}" and data/r.json '{"x":1}'

  @test:schemas/ui/rendered-impact.test.ts::diffBuiltSites::every_added,_changed_and_removed_file,_by_content,_with_a_role;_unchanged_files_are_absent
  Scenario: A build diff lists every added, changed and removed file with its role
    When sites "a" and "b" are diffed for the jekyll renderer
    Then the method is "build-diff"
    And the files are search-data.json changed (index), data/r.json changed (data), gone.html removed, new.html added and page.html changed (content), in that order
    And same.html is not listed

  @test:schemas/ui/rendered-impact.test.ts::diffBuiltSites::each_changed_file_is_pinned_to_its_content;_a_removed_file_has_nothing_to_pin
  Scenario: Changed and added files carry a content hash; a removed file does not
    When sites "a" and "b" are diffed
    Then page.html and new.html each carry a 64-hex hash
    And gone.html carries none

  @test:schemas/ui/rendered-impact.test.ts::diffBuiltSites::build_stamps_are_not_content:_two_builds_of_one_page_differ_only_by_them,_and_are_not_a_change
  Scenario: Build stamps are not a change
    Given two builds whose page.html differ only by a "?v=" cache-buster
    And whose meta.json differ only by generatedAt and sourceTreeDirty
    And whose real.json differ in content
    When the two builds are diffed
    Then real.json alone is listed

  @test:schemas/ui/rendered-impact.test.ts::diffBuiltSites::`keep`_limits_BOTH_sides,_so_another_site_under_a_shared_root_is_neither_removed_nor_added
  Scenario: The keep filter applies to both sides
    When sites "a" and "b" are diffed keeping every path but gone.html and new.html
    Then the files are search-data.json, data/r.json and page.html

  @test:schemas/ui/rendered-impact.test.ts::diffBuiltSites::the_review_list_drops_index_files_and_nothing_else
  Scenario: The review list drops index files and nothing else
    Given the diff of sites "a" and "b"
    When its review list is taken
    Then it is data/r.json, gone.html, new.html and page.html

  @test:schemas/ui/rendered-impact.test.ts::comparePrediction::a_measured_change_the_cone_did_not_predict_is_MISSED;_a_content_page_whose_bytes_did_not_move_is_only_unconfirmed
  Scenario: An unpredicted measured change is missed; a predicted unmoved page is unconfirmed
    Given a cone prediction of p.html (content) and d/r.json (data)
    And a measurement of d/r.json (data) and other.html (content)
    When the prediction is compared with the measurement
    Then other.html is missed
    And d/r.json is confirmed
    And p.html, a content page, is unconfirmed

  @test:schemas/ui/rendered-impact.test.ts::comparePrediction::could-not-determine_is_carried,_never_read_as_no_change
  Scenario: An undetermined input is carried, pinned, and not read as no change
    # Gap: comparePrediction's result has no field for undetermined inputs, so
    # it cannot report them itself; the prediction carries them.
    Given a cone impact with no files and one undetermined input sushi-config.yaml, site-wide
    When it is parsed with the rendered-impact schema
    Then its files are empty
    And it carries exactly that undetermined entry
    When it is pinned
    Then it still carries that one entry, with a 64-hex pin
    When it is compared with a build-diff that changed other.html
    Then other.html is reported missed and nothing is confirmed

  @test:schemas/ui/rendered-impact.test.ts::pinImpact::a_file_is_pinned_to_the_changed_inputs_on_its_via,_and_nothing_else_on_it
  Scenario: A file's pin depends on the inputs on its via, not on other via entries
    Given a cone impact over inputs a.md, b.md and cfg.yaml, where p.html is reached via a.md and "prose:a"
    When it is pinned against the input blobs
    Then p.html carries a 64-hex pin
    And renaming its "prose:a" via entry to "prose:renamed" leaves that pin unchanged

  @test:schemas/ui/rendered-impact.test.ts::pinImpact::an_edit_moves_the_pin_of_exactly_the_files_and_inputs_it_touched
  Scenario: An edit moves only the pins it touches
    Given the pinned impact, where q.html is reached via a.md and b.md and p.html via a.md alone
    When it is pinned again with b.md's blob changed
    Then p.html's pin is unchanged
    And q.html's pin moves
    And the undetermined cfg.yaml entry's pin is unchanged

  @test:schemas/ui/rendered-impact.test.ts::pinImpact::a_file_reached_by_no_changed_input_is_left_unpinned_rather_than_pinned_to_nothing
  Scenario: A file reached by no input is left unpinned
    Given the pinned impact, where idx.json has an empty via
    Then idx.json carries no pin

  @test:schemas/ui/rendered-impact.test.ts::pinImpact::a_removed_input_pins_as_absent,_which_differs_from_any_version_of_it
  Scenario: A removed input pins differently from every version of it
    Given the base impact
    When it is pinned with a.md absent
    Then p.html's and q.html's pins each differ from their pins with a.md at version "1", "1b", the empty string, or forty zeros

  @test:schemas/ui/rendered-impact.test.ts::RenderedMeasuredSchema::missedFiles_returns_the_measured_files_the_prediction_did_not_name,_with_their_pins
  Scenario: The missed files come back with their pins
    Given a known measurement of x.html (hash h1) and y.html (hash h2), whose check lists y.html as missed
    When the missed files are asked for
    Then the answer is y.html, changed, content, with an empty via and hash h2
