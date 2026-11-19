#!/bin/bash
# Detects greeting-only prompts and injects task selection context.
# Used by UserPromptSubmit hook.

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt // ""' | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

# Strip punctuation for matching
clean=$(echo "$prompt" | sed 's/[^a-z ]//g' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

# Match common greetings (whole-prompt match — not mid-sentence)
case "$clean" in
  hi|hello|hey|greetings|howdy|sup|yo|hiya|"good morning"|"good afternoon"|"good evening"|"whats up"|"hey there"|"hello there"|"hi there")
    cat <<'ENDJSON'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "The user greeted you. Present a friendly task selection menu using AskUserQuestion. Ask: \"What would you like to work on?\" with these options:\n1. Review TODOs — scan content blocks for status updates, sorry audits, and proof progress\n2. Content blocks — create, edit, or validate content object triples (.ts/.md/.lean)\n3. Lean proofs — fill sorries, formalize definitions, or review proof status\n4. LaTeX / build — validate LaTeX rendering, run the content pipeline, or check cross-refs\nKeep your greeting response brief and warm before presenting the question."
  }
}
ENDJSON
    ;;
  *)
    # Not a greeting — no injection
    echo '{}'
    ;;
esac
