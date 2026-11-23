/** The layers this subgraph's schemas hold, for the engine in ../../L1/schemas/ (layers.ts). */
import type { LayerSpec } from "../../L1/schemas/ontology.ts";
import { L2 } from "./l2.ts";

export const layers: LayerSpec[] = [L2];
