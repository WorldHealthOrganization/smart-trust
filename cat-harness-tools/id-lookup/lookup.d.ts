/** Types for `lookup.js`, which stays plain JavaScript so a browser loads it as written. */
export function splitId(id: string): { ns: string; local: string } | null;
export function shardFile(ns: string, local: string, prefixLength: number): string;
export function normalise(input: unknown): string;
export const SHARD_CACHE_SIZE: number;

export interface LookupEntry {
  id: string;
  title: string;
  url: string;
}
export type LookupResult =
  | { state: "found"; entry: LookupEntry; fetched: string[] }
  | { state: "absent"; fetched: string[] }
  | { state: "too-short"; need: number };

export interface IdIndex {
  manifest: {
    namespaces: Record<string, { prefixLength: number; entryCount: number; shards: string[] }>;
    [k: string]: unknown;
  };
  lookup(input: string): Promise<LookupResult>;
}

export function openIndex(base: string, fetchImpl?: (url: string) => Promise<Response>): Promise<IdIndex>;
