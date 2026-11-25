The **FHIR IG Publisher** is HL7's tool that turns an implementation guide's
sources into a published site. Here it is a *mechanical actor*: a process
step with declared inputs and outputs.

In a build with pre- and post-processing it is **one step among many**. API
sidecars, JSON Schemas and JSON-LD vocabularies on a published IG are written
by scripts *after* it exits, not by the Publisher.
