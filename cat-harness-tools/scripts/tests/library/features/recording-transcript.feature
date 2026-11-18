# A recording as a library entry, and its transcripts (bean
# folio-assistant-1r0p). Each Scenario names the test that executes it.
Feature: A recording and its transcripts in the library

  @test:scripts/tests/library/recording-transcript.test.ts::the_arm::writes_a_valid_record_and_a_recogniser's_draft,_and_the_entry_passes
  Scenario: The recording arm writes a record and a draft transcript that pass
    Given a staged MP4 recording with an identity, a whisper.cpp JSON and a recogniser record
    Then recording.json parses with sniffed type video/mp4
    And transcript/en.json parses as a draft by the transcribe-whisper-cpp script
    And its segments are the two whisper segments in milliseconds, trimmed
    And it cites the recording's sha256
    And the entry is of kind recording, every L1 requirement is met, and the audio detail says "en (source, draft)"

  @test:scripts/tests/library/recording-transcript.test.ts::the_arm::the_manifest_lists_one_transcript_block,_crediting_its_drafter
  Scenario: The manifest lists one transcript block crediting its drafter
    Given a staged recording entry
    Then the manifest's title is the identity title, taken from recording.json identity.title
    And it contains exactly the transcript-en block
    And that block is of kind transcript, points at ../transcript/en.json and credits the recogniser script

  @test:scripts/tests/library/recording-transcript.test.ts::the_arm::the_segments_digest_is_one_definition_in_Python_and_TypeScript
  Scenario: Python and TypeScript compute one segments digest
    Given a staged recording entry
    When recording-transcript.py computes the segments-sha256 of transcript/en.json
    Then it equals the sha256 of the TypeScript canonical segments

  @test:scripts/tests/library/recording-transcript.test.ts::the_arm::refuses_an_identity_missing_a_field,_a_file_that_is_not_a_recording,_and_a_translate_run
  Scenario: The arm refuses a bad identity, a non-recording and a translate run
    When a recording is recorded with an identity missing its language
    Then it exits 1 saying "never guess"
    And when a PDF is recorded it exits 1 saying "not audio or video"
    And a whisper JSON from a translate run is refused as "translation, not a transcript"
    And a whisper JSON that heard fr for an en recording is refused as "the recogniser heard fr"

  @test:scripts/tests/library/recording-transcript.test.ts::the_gate::a_PDF_entry_is_not_a_recording,_said_as_a_determined_answer
  Scenario: A PDF entry is not a recording, as a met requirement
    Given an entry whose referenced.json sniffed application/pdf
    Then its audio-transcripts requirement is met with detail "not a recording (application/pdf)"

  @test:scripts/tests/library/recording-transcript.test.ts::the_gate::a_recording_with_no_transcript_in_its_spoken_language_is_unmet
  Scenario: A recording with no source-language transcript is unmet
    Given a staged recording entry whose transcript/en.json is removed
    Then its audio-transcripts requirement is unmet, naming "no transcript/en.json"

  @test:scripts/tests/library/recording-transcript.test.ts::the_gate::a_translation_passes;_a_stale_one_is_reported_and_does_not_fail
  Scenario: A translation passes, and a stale one is reported without failing
    Given a staged recording entry with a French translation and a regenerated manifest
    Then the audio-transcripts requirement is met, naming "fr (translation, draft)"
    And the manifest contains two blocks
    And when the English source segment is edited, it stays met and reports "1 stale translation(s)"

  @test:scripts/tests/library/recording-transcript.test.ts::the_gate::a_translation_cut_at_other_times,_of_other_bytes,_or_in_a_misnamed_file_is_unmet
  Scenario: A mismatched translation is reported
    # Gap: the title says each case is UNMET; the body checks only the detail text, never the requirement's state.
    Given a staged recording entry
    When its French translation has one segment spanning both source segments
    Then the audio detail says "not the source's, one for one"
    And when it cites other recording bytes, the detail says "transcribes other bytes"
    And when fr.json holds lang es, the detail says "holds lang es"

  @test:scripts/tests/library/recording-transcript.test.ts::the_gate::a_transcript_drafted_by_an_agent_with_no_model_is_unmet
  Scenario: A transcript drafted by an agent with no model is unmet
    Given a staged recording entry with a French translation drafted by an agent that names no model
    Then its audio-transcripts requirement is unmet

  @test:scripts/tests/library/recording-transcript.test.ts::the_ingest_router::a_recording_is_refused_with_the_route,_not_opened_as_a_PDF
  Scenario: The ingest router refuses a recording with its route
    When a plan is made for talk.mp4 sniffed as video/mp4
    Then the rung is undetermined, the reason names recording-transcript.py, and there are no steps
