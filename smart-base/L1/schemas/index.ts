/** The layers this subgraph's schemas hold, for the engine's registry (layers.ts). */
import type { LayerSpec } from "./ontology.ts";
import { L1 } from "./l1.ts";
import { L1_LIBRARY } from "./l1-library.ts";

export const layers: LayerSpec[] = [L1, L1_LIBRARY];
