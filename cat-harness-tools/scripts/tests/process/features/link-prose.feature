# linkProse: process ids and skill names in BPMN documentation become links,
# and what cannot be linked is reported. escapeAngles keeps a placeholder from
# opening an HTML element.
Feature: Process ids and skill names in BPMN prose become links

  @test:scripts/tests/process/link-prose.test.ts::linkProse::the_public-comment_sentence_the_owner_pointed_at
  Scenario: A process id and a "Skill:" name in a sentence are both linked
    Given a known process "Process_ContentChangeReview" and known skills "public-comment" and "review-comments"
    When the public-comment documentation sentence is linked
    Then "(Process_ContentChangeReview)" becomes a link to content-change-review.html
    And "Skill: public-comment" becomes a code link to ../skills/public-comment.html
    And nothing is reported unlinked

  @test:scripts/tests/process/link-prose.test.ts::linkProse::backticked_ids_and_skills,_and_lists_after_Skills:
  Scenario: Backticked ids and skills, and a "Skills:" list, are linked
    Given the known process and skills
    When "calls `Process_ContentChangeReview`", "see `review-comments`" and "Skills: public-comment, review-comments" are linked
    Then the backticked process id becomes a code link to its page
    And the backticked skill becomes a code link to its skill page
    And each skill in the "Skills:" list becomes a code link

  @test:scripts/tests/process/link-prose.test.ts::linkProse::existing_links_are_left_alone
  Scenario: Existing links are left alone
    Given text already holding Markdown links to the process id and a skill
    When it is linked
    Then the text is unchanged

  @test:scripts/tests/process/link-prose.test.ts::linkProse::what_cannot_be_linked_is_reported,_not_silently_left
  Scenario: An unknown process id and an unknown skill are reported
    Given text naming "Process_Gone" and "Skill: no-such-skill"
    When it is linked
    Then the text is unchanged
    And the unlinked list is "Process_Gone" and "skill:no-such-skill"

  @test:scripts/tests/process/link-prose.test.ts::linkProse::a_backticked_kebab_word_that_is_not_a_skill_stays_code_and_is_not_reported
  Scenario: A backticked kebab word that is not a skill stays code
    Given the text "run `render-bpmn` first"
    When it is linked
    Then the text is unchanged
    And nothing is reported unlinked

  @test:scripts/tests/process/link-prose.test.ts::escapeAngles::a_placeholder_no_longer_opens_an_HTML_element_that_swallows_the_links_after_it
  Scenario: An angle-bracket placeholder is escaped and the link after it survives
    Given linked text holding "PC/<version>" followed by a process link
    When its angle brackets are escaped
    Then "<version>" becomes "&lt;version&gt;"
    And the process link after it is intact

  @test:scripts/tests/process/link-prose.test.ts::escapeAngles::code_spans_keep_their_brackets
  Scenario: Angle brackets inside a code span are kept
    Given the text "run `pc:release <version>` for <slug>"
    When its angle brackets are escaped
    Then the code span keeps "<version>"
    And "<slug>" outside it becomes "&lt;slug&gt;"
