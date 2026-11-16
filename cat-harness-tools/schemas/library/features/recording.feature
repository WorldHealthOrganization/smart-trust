# Specifies the recording and transcript schemas in schemas/library/recording.ts, which
# mimetypes count as recordings, and a transcript read as a narrative.
# Each Scenario names the test that executes it.
Feature: A recording and its transcript are recorded, checked and read as a narrative

  @test:schemas/library/recording.test.ts::RecordingSchema::accepts_a_recording_record
  Scenario: A recording record is accepted
    Given a "folio-recording/v1" record with title, date, language "en", two speakers, an mp4 source and a duration
    When it is checked against the recording schema
    Then it passes

  @test:schemas/library/recording.test.ts::RecordingSchema::refuses_a_recording_with_no_language
  Scenario: A recording with no language is refused
    Given a recording record whose identity has a title and date but no language, and a null duration
    When it is checked against the recording schema
    Then it fails

  @test:schemas/library/recording.test.ts::RecordingSchema::audio_and_video_are_recordings,_a_PDF_is_not
  Scenario: Audio and video mimetypes are recordings, a PDF is not
    Then "video/mp4" and "audio/wav" are recording mimetypes
    And "application/pdf" and no mimetype are not

  @test:schemas/library/recording.test.ts::TranscriptSchema::accepts_a_recogniser's_draft
  Scenario: A recogniser's draft transcript is accepted
    Given a "folio-transcript/v1" draft in "en" naming its recogniser and drafted by the script, with two ordered segments
    When it is checked against the transcript schema
    Then it passes

  @test:schemas/library/recording.test.ts::TranscriptSchema::a_transcript_names_its_recogniser_or_what_it_translates,_not_neither_and_not_both
  Scenario: A transcript names its recogniser or what it translates, not neither and not both
    Given the draft transcript
    When its recogniser is removed
    Then it fails the transcript schema
    And with both a recogniser and "translated_from" it fails

  @test:schemas/library/recording.test.ts::TranscriptSchema::a_translation_names_its_source_language,_which_is_another_language
  Scenario: A translation names a source language other than its own
    Given a "fr" transcript with no recogniser, translated from "en" and drafted by an agent naming its model
    When it is checked against the transcript schema
    Then it passes
    And the same transcript translated from "fr" fails

  @test:schemas/library/recording.test.ts::TranscriptSchema::the_narrative's_rules_apply:_only_a_human_confirms,_an_agent_names_its_model
  Scenario: Only a human confirms a transcript, an agent drafter names its model, and a drafter is required
    Given the draft transcript
    When it is marked confirmed by a script
    Then it fails the transcript schema
    And confirmed by a human it passes
    And drafted by an agent with no model it fails
    And with no drafter it fails

  @test:schemas/library/recording.test.ts::TranscriptSchema::segments_are_timed_and_in_order
  Scenario: Segments must be timed forwards, in order, and present
    Given the draft transcript
    When its one segment ends before it starts
    Then it fails the transcript schema
    And two segments out of order fail
    And no segments fail

  @test:schemas/library/recording.test.ts::TranscriptSchema::read_as_a_narrative,_it_is_its_segments'_text
  Scenario: Read as a narrative, a transcript is its segments' text
    Given the parsed draft transcript
    When it is read as a narrative
    Then its text is "Hi, this is a walkthrough. Second segment."
    And its canonical segments are the start, end and text of each, as a JSON array
