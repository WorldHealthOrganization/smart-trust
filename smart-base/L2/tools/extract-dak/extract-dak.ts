import { defineTool, toolFactory } from "../../../platform/index.js";

export default toolFactory((t) =>
  defineTool({
    id: "extract-dak",
    title: "DAK spreadsheets → DMN, PlanDefinitions, CQL, requirements, logical models",
    description:
      "Run WHO's `extract_dak.py` in a DAK or IG repository. It reads the DAK template spreadsheets (`input/decision-logic/*.xlsx` via `dt_extractor`, `input/system-requirements/*.xlsx` via `req_extractor`, `input/dictionary/*.xlsx` via `dd_extractor`) and the BPMN, and writes DMN decision tables, CPG recommendation PlanDefinitions with citations, CQL library skeletons, Requirements and logical-model FSH. Per the WHO IG Starter Kit (`l3_decisiontables`, `l3_cql`), an adapted decision or scheduling table is an edited copy of the upstream DAK's spreadsheet, never a parallel format.",
    install: { none: true },
    invoke: { shell: "python3 $SMART_BASE_HOME/input/scripts/extract_dak.py" },
    io: {
      inputs: [
        { name: "dakRepository", schema: t("FilesystemPath"), required: true, description: "The working directory: a DAK or IG repository with `input/decision-logic/`, `input/system-requirements/` and `input/dictionary/` spreadsheets in the DAK template layout." },
      ],
      outputs: [
        { name: "dmn", schema: t("RepoPath"), description: "Decision tables in the DAK DMN format (namespace `https://www.omg.org/spec/DMN/20240513/MODEL/`), each with an `Annotations` and a `Reference(s)` output." },
        { name: "fsh", schema: t("RepoPath"), description: "PlanDefinition, ActivityDefinition, Requirements and logical-model FSH, for SUSHI to compile." },
        { name: "cql", schema: t("RepoPath"), description: "CQL library skeletons, one per decision table, with the definitions already present in `input/cql/` carried over." },
      ],
    },
    satisfies: ["smart-base-tools"],
    selection: {
      when: "An L2 decision-support, scheduling, requirements or data-dictionary component is created or adapted and the upstream DAK keeps it in the WHO DAK spreadsheet template. Look for that spreadsheet upstream before writing a decision table by hand.",
      limits:
        "Reads only the DAK template layout (COVER sheet, per-tab inputs and outputs); a table in any other shape is invisible to it. Requires a `smart-base` checkout at `SMART_BASE_HOME`; without one the capability is ABSENT, not a clean run. Where the upstream DAK repository has its own converters (e.g. `tools/node/processDT*.js` in https://github.com/litlfred/smart-immunizations), use those.",
      cost: "Seconds to minutes, no network unless `--run-publisher` is passed.",
    },
    requires: { runtime: ["python3"], network: false },
  }),
);
