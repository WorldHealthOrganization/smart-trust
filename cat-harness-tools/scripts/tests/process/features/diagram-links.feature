# The links in a rendered BPMN drawing: a step's title links to its page, a
# call activity's [+] marker to the process it calls, and neither wraps the
# whole box. The shape markup is bpmn-js's own.
Feature: A rendered BPMN drawing links each step's title and each call activity's marker

  @test:scripts/tests/process/diagram-links.test.ts::a_step's_title_link::wraps_the_title_text_and_nothing_else_of_the_box
  Scenario: A title link wraps the label and not the box
    Given a rendered SVG holding the task "A_Request" and the call activity "Call_Sign"
    When A_Request's title is linked to its step page
    Then the link has class fa-task-link, the page href and target _top
    And it wraps the djs-label text and no <rect>
    And the task's box rect stays just before the link, outside it

  @test:scripts/tests/process/diagram-links.test.ts::a_step's_title_link::has_an_accessible_name,_escaped
  Scenario: A title link has an escaped accessible name
    Given the same SVG with A_Request's title linked under the name "Request & sign"
    When the link is read
    Then its aria-label and its <title> are "Open step: Request &amp; sign"

  @test:scripts/tests/process/diagram-links.test.ts::a_step's_title_link::leaves_the_SVG_alone_when_the_shape_is_not_there
  Scenario: Linking a missing shape's title leaves the SVG unchanged
    Given the same SVG
    When the title of a shape "Nope" that is not in it is linked
    Then the SVG is unchanged

  @test:scripts/tests/process/diagram-links.test.ts::a_step's_title_link::decodes_a_name's_character_references_once,_so_they_are_not_escaped_twice
  Scenario: A name's character references are decoded once, not escaped twice
    Given the SVG with A_Request's title linked under the name "Sign with Country B&#x27;s key &amp; go"
    When the link is read
    Then its aria-label reads "Open step: Sign with Country B's key &amp; go"
    And "&amp;#x27;" appears nowhere

  @test:scripts/tests/process/diagram-links.test.ts::a_call_activity's_[+]_link::wraps_only_the_marker_box_and_its_cross,_not_the_title_or_the_shape
  Scenario: The [+] link wraps only the sub-process marker
    Given the same SVG
    When Call_Sign's expand marker is linked to the called process
    Then the link holds the sub-process marker path and its box at matrix(1 0 0 1 52.5 100)
    And it holds neither the label nor the 120-wide shape rect
    And no link wraps a whole djs-element

  @test:scripts/tests/process/diagram-links.test.ts::a_call_activity's_[+]_link::gets_a_24_×_24_hit_area_centred_on_the_marker,_drawn_under_it
  Scenario: The [+] link has a 24 × 24 hit area under the marker
    Given Call_Sign's expand marker linked
    When the link is read
    Then it holds a transparent fa-link-hit rect at x 47.5, y 95, 24 wide and 24 high
    And that rect comes before the marker path

  @test:scripts/tests/process/diagram-links.test.ts::a_call_activity's_[+]_link::has_an_accessible_name
  Scenario: The [+] link has an accessible name
    Given Call_Sign's expand marker linked under the name "Sign the certification"
    When the link is read
    Then its aria-label is "Open subprocess: Sign the certification"

  @test:scripts/tests/process/diagram-links.test.ts::linkSteps::both_links_on_one_call_activity,_separate,_plus_the_style_once
  Scenario: Title and expand links are added together, unnested, with one style block
    Given the same SVG, title links for Call_Sign and A_Request, and an expand link for Call_Sign
    When the steps are linked
    Then there are 2 title links and 1 expand link
    And there is exactly one <style>, containing :focus-visible
    And no link is nested in another, and Call_Sign's shape still has a span

  @test:scripts/tests/process/diagram-links.test.ts::linkSteps::no_links_→_the_SVG_unchanged,_no_style
  Scenario: With no links the SVG is unchanged
    Given the same SVG and no title or expand links
    When the steps are linked
    Then the SVG is unchanged

  @test:scripts/tests/process/diagram-links.test.ts::stepsOf::every_named_activity_with_the_process_that_holds_it
  Scenario: Every named activity is listed with its process
    Given definitions with process P (a start event, a user task, a call activity, a sub-process holding a task) and process Q (a named and an unnamed task)
    When the steps are read
    Then they are T, C, SP and T2 in P and U in Q, with names decoded
    And the start event and the unnamed task are not steps
