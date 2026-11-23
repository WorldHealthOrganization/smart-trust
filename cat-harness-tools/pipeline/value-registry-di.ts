/**
 * Dependency injection point for the values registry.
 * Since the values registry (WITNESSED_VALUES) is domain-specific content,
 * it lives in the downstream repo (e.g. qou) while the pipeline code lives
 * here in folio-assistant. Downstream runner scripts must call
 * `configureValueRegistry` before invoking pipeline functions.
 */

export type WitnessedValueFormat = "decimal" | "scientific" | "measured";

export interface WitnessedValueEntry {
  readonly name: string;
  readonly description: string;
  readonly symbol: string;
  readonly witnessFile: string;
  readonly witnessPath: string;
  readonly defaultPrecision: number;
  readonly units: string | null;
  readonly errorEntry?: string;
  readonly format?: WitnessedValueFormat;
  readonly needsReview?: boolean;
}

export interface ValueRegistryAPI {
  WITNESSED_VALUES: Readonly<Record<string, WitnessedValueEntry>>;
  lookupValue: (name: string) => WitnessedValueEntry | undefined;
  verifiedNames: () => readonly string[];
}

let currentApi: ValueRegistryAPI | null = null;

export function configureValueRegistry(api: ValueRegistryAPI) {
  currentApi = api;
}

export function getValueRegistry(): ValueRegistryAPI {
  if (!currentApi) {
    throw new Error(
      "Value registry not configured. " +
      "The downstream repo must call configureValueRegistry() before running pipeline functions."
    );
  }
  return currentApi;
}

export const WITNESSED_VALUES: Readonly<Record<string, WitnessedValueEntry>> = new Proxy({}, {
  get: (_, prop: string) => getValueRegistry().WITNESSED_VALUES[prop],
  ownKeys: () => Reflect.ownKeys(getValueRegistry().WITNESSED_VALUES),
  getOwnPropertyDescriptor: (_, prop) => Reflect.getOwnPropertyDescriptor(getValueRegistry().WITNESSED_VALUES, prop)
});

export function lookupValue(name: string): WitnessedValueEntry | undefined {
  return getValueRegistry().lookupValue(name);
}

export function verifiedNames(): readonly string[] {
  return getValueRegistry().verifiedNames();
}
