**Only some sources are themes, and a person decides which.** After content is
derived, the gateway *A theme source?* asks whoever is ingesting whether this
document also carries a theme: a deployed site that serves one, or a style
guide that states one. No rule computes the answer: whether a branded document is a theme source is
an authoring judgement. A source that is not a theme skips straight to
building the knowledge graph.

The decision sits at a gateway, not inside the subprocess, because "this is
not a theme" (the normal case) and "this theme is malformed" (a defect, which
the subprocess reports by refusing) are different outcomes.

Inside, the two kinds of source differ in one step only: a deployment's
**served** stylesheet is read for its declarations, while a guide's **stated**
rules are read as it writes them. After that the paths join:

- values are mapped onto the shared palette **roles**;
- contradictions **in the source** are recorded as data, never silently resolved
  by picking one;
- a value the source is silent on is marked as a choice, not presented as a
  measurement;
- if a layout is missing, the subprocess **refuses** as incomplete rather than
  producing a theme quietly degraded to the layouts it was given.

A complete theme goes to the theme and UI review, and the result is one Theme
node: one kind, because the palette vocabulary is shared and only the geometry
varies between a sticky, a webpage and a publication.
