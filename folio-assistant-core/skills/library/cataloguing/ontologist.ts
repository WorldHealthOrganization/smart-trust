import type { SkillDefinition } from "@litlfred/cat-harness-tools/schemas/conduct/assistant-types.js";

export const ontologist: SkillDefinition = {
  id: "ontologist",
  name: "Ontologist",
  description: "Term disambiguation, glossary generation, and formal-naming alignment.",
  requiredCapabilities: [
    { capabilityId: "git-read", degradation: "fail" },
  ],
  dependsOn: [
    { ref: "content-validation", kind: "skill", conformance: "SHOULD" },
  ],
  routingPatterns: ["glossary", "terminology", "naming", "disambiguat"],
  tags: ["ontology", "glossary", "naming"],
};
