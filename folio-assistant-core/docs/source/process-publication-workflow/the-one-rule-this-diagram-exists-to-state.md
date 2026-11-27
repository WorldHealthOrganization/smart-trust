**Nothing reaches the corpus before the editor has seen the findings.** The
authoring agent produces a *proposed* change, not a commit. That proposal fans
out through the HCI validation pipeline, the results are collated into one
report, and the editor decides — accept, revise, or discard. The `Commit into
the corpus` activity sits *after* that decision, in its own lane, and is the
only step that writes content.
