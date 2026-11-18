/**
 * `archimate-relationship-rules/v1`: the relationships a reference
 * architecture's authors allow between element types, written once as data.
 *
 * A reference architecture's document lists its rules ("an Application
 * Component realises an Application Service", "a Goal is composed of
 * sub-goals") and the relationship types it uses. Typed by hand, that table
 * says nothing about the model: the two drift, and nobody can tell. Held here,
 * the document's tables are drawn from it (Tool `archimate-blocks`) and the
 * model is checked against it.
 *
 * The rules are in charge, not the model (owner, 2026-11-01, smart-ra Q-RAC-2
 * "the rules stay in charge"): a model relationship no rule covers is reported
 * for the model's authors to fix or for the editors to add a rule. Nothing
 * here rewrites the rules from the model.
 *
 * @graphNode schema
 * @module cat-harness/archimate/schemas/rules
 * @conformsTo opengroup-archimate-3.0
 * @covers archimate
 */
import { z } from "zod";
import type { ArchimateModel } from "./archimate.ts";
import { isAllowed, isPlaceholder, relKind, typeName, type RelationshipTable } from "./metamodel.ts";

export const RELATIONSHIP_RULES_TAG = "archimate-relationship-rules/v1";

/** An ArchiMate type name without Archi's prefix or suffix: `ApplicationComponent`, `Realization`. */
const TypeName = z.string().regex(/^[A-Z][A-Za-z]+$/, "an ArchiMate type, e.g. ApplicationComponent");

export const RelationshipTypeEntrySchema = z
  .object({
    /** The ArchiMate relationship type, without `Relationship`: `Realization`. */
    type: TypeName,
    /** What the document calls it in a rule: `Realisation`. */
    name: z.string().min(1),
    /** The verb the relationship-types table shows: `Realises`. Default: `name`. */
    verb: z.string().min(1).optional(),
    /** The notation picture, relative to the block, shown in the relationship-types table. */
    icon: z.string().min(1).optional(),
    /**
     * What it represents, in the document's words (Markdown). Only entries
     * with a meaning are rows of the relationship-types table; a type the
     * rules use with no meaning is reported, since the document then uses a
     * relationship it never explains.
     */
    meaning: z.string().min(1).optional(),
  })
  .strict();
export type RelationshipTypeEntry = z.infer<typeof RelationshipTypeEntrySchema>;

export const RelationshipRuleSchema = z
  .object({
    source: TypeName,
    relationship: TypeName,
    target: TypeName,
    /** Why the rule is there, in the document's words. */
    note: z.string().min(1),
  })
  .strict();
export type RelationshipRule = z.infer<typeof RelationshipRuleSchema>;

export const RelationshipRulesSchema = z
  .object({
    $schema: z.literal(RELATIONSHIP_RULES_TAG),
    title: z.string().min(1).optional(),
    /** Where the rules were taken from: a document block, an IRI. */
    source: z.string().min(1).optional(),
    relationships: z.array(RelationshipTypeEntrySchema).min(1),
    rules: z.array(RelationshipRuleSchema).min(1),
  })
  .strict()
  .superRefine((r, ctx) => {
    const types = new Set<string>();
    for (const [i, t] of r.relationships.entries()) {
      if (types.has(t.type)) ctx.addIssue({ code: "custom", path: ["relationships", i, "type"], message: `relationship type ${t.type} is listed twice` });
      types.add(t.type);
    }
    const seen = new Set<string>();
    for (const [i, x] of r.rules.entries()) {
      if (!types.has(x.relationship)) ctx.addIssue({ code: "custom", path: ["rules", i, "relationship"], message: `${x.relationship} is not in \`relationships\`` });
      const key = `${x.source} ${x.relationship} ${x.target}`;
      if (seen.has(key)) ctx.addIssue({ code: "custom", path: ["rules", i], message: `rule ${key} is listed twice` });
      seen.add(key);
    }
  });
export type RelationshipRules = z.infer<typeof RelationshipRulesSchema>;

/** A Markdown table cell: no pipe or line break may end the cell early. */
const cell = (s: string): string => s.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, "<br>");

/** The rules table: Source | Relationship | Target | Note, in the file's order. */
export function rulesTableMarkdown(r: RelationshipRules): string {
  const name = new Map(r.relationships.map((t) => [t.type, t.name]));
  return [
    "| Source | Relationship | Target | Note |",
    "| --- | --- | --- | --- |",
    ...r.rules.map((x) => `| ${cell(typeName(x.source))} | ${cell(name.get(x.relationship) ?? x.relationship)} | ${cell(typeName(x.target))} | ${cell(x.note)} |`),
  ].join("\n");
}

/** The relationship-types table: the picture, the verb and what it represents, for each type with a meaning. */
export function relationshipTypesTableMarkdown(r: RelationshipRules): string {
  return [
    "| **ArchiMate relationship** | **Relationship type** | **What it represents** |",
    "| --- | --- | --- |",
    ...r.relationships
      .filter((t) => t.meaning !== undefined)
      .map((t) => {
        const verb = t.verb ?? t.name;
        return `| ${t.icon ? `![${cell(verb)}](${t.icon})` : ""} | **${cell(verb)}** | ${cell(t.meaning!)} |`;
      }),
  ].join("\n");
}

/** One (source type, relationship, target type) pattern in a model, with its relationships. */
export interface RulePattern {
  source: string;
  relationship: string;
  target: string;
  count: number;
  /** The relationships' ids. */
  relationships: string[];
}

/** What checking a model against the rules finds. */
export interface RulesCheck {
  $schema: "archimate-relationship-rules-check/v1";
  model: string;
  /** Relationships counted (those between two elements, Grouping's left out). */
  checked: number;
  /** Model patterns no rule covers, most used first. */
  uncovered: RulePattern[];
  /** How many relationships those patterns hold. */
  uncoveredCount: number;
  /** Each rule and how often the model follows it; a count of 0 is a rule the model never uses. */
  used: Array<RelationshipRule & { count: number }>;
  /** Rules ArchiMate's own relationship table does not allow. */
  notAllowed: RelationshipRule[];
  /** Relationship types a rule uses that have no `meaning`, so the document never explains them. */
  unexplained: string[];
}

/**
 * Check a model against the rules. A relationship to or from a `Grouping`,
 * a `Junction`, another relationship or a placeholder (an element named after
 * its own type, as a hand-drawn metamodel leaves them) is left out: those
 * structure a drawing, and the rules are about what the architecture's
 * elements mean.
 */
export function checkRules(model: ArchimateModel, modelId: string, r: RelationshipRules, table: RelationshipTable): RulesCheck {
  const typeOf = new Map(model.elements.filter((e) => !isPlaceholder(e)).map((e) => [e.id, e.type]));
  const skip = new Set(["Grouping", "Junction"]);
  const patterns = new Map<string, RulePattern>();
  let checked = 0;
  for (const rel of model.relationships) {
    const s = typeOf.get(rel.source);
    const t = typeOf.get(rel.target);
    if (s === undefined || t === undefined || skip.has(s) || skip.has(t)) continue;
    checked++;
    const kind = relKind(rel.type);
    const key = `${s} ${kind} ${t}`;
    const p = patterns.get(key) ?? { source: s, relationship: kind, target: t, count: 0, relationships: [] };
    p.count++;
    p.relationships.push(rel.id);
    patterns.set(key, p);
  }
  const ruleKey = (x: RelationshipRule) => `${x.source} ${x.relationship} ${x.target}`;
  const covered = new Set(r.rules.map(ruleKey));
  const uncovered = [...patterns.values()]
    .filter((p) => !covered.has(`${p.source} ${p.relationship} ${p.target}`))
    .sort((a, b) => b.count - a.count || `${a.source}${a.relationship}${a.target}`.localeCompare(`${b.source}${b.relationship}${b.target}`));
  const explained = new Set(r.relationships.filter((t) => t.meaning !== undefined).map((t) => t.type));
  return {
    $schema: "archimate-relationship-rules-check/v1",
    model: modelId,
    checked,
    uncovered,
    uncoveredCount: uncovered.reduce((n, p) => n + p.count, 0),
    used: r.rules.map((x) => ({ ...x, count: patterns.get(ruleKey(x))?.count ?? 0 })),
    notAllowed: r.rules.filter((x) => isAllowed(table, x.source, `${x.relationship}Relationship`, x.target) === false),
    unexplained: [...new Set(r.rules.map((x) => x.relationship))].filter((t) => !explained.has(t)),
  };
}

/** The check as a person reads it in a terminal or a CI log. */
export function rulesCheckReport(c: RulesCheck, label: string): string {
  const lines = [`${label} against model ${c.model}: ${c.checked} relationship(s) checked`];
  const unused = c.used.filter((u) => u.count === 0);
  lines.push(
    unused.length
      ? `  ! ${unused.length} of ${c.used.length} rule(s) the model never uses:`
      : `  ✓ the model uses every one of the ${c.used.length} rule(s)`,
  );
  for (const u of unused) lines.push(`    ${typeName(u.source)} ${u.relationship} ${typeName(u.target)}`);
  lines.push(
    c.uncovered.length
      ? `  ! ${c.uncoveredCount} relationship(s) in ${c.uncovered.length} pattern(s) no rule covers:`
      : "  ✓ every relationship follows a rule",
  );
  for (const p of c.uncovered) lines.push(`    ${typeName(p.source)} ${p.relationship} ${typeName(p.target)} ×${p.count}`);
  if (c.notAllowed.length) {
    lines.push(`  ✗ ${c.notAllowed.length} rule(s) ArchiMate's relationship table does not allow:`);
    for (const x of c.notAllowed) lines.push(`    ${typeName(x.source)} ${x.relationship} ${typeName(x.target)}`);
  }
  if (c.unexplained.length) lines.push(`  ! relationship type(s) the rules use but the relationship-types table does not explain: ${c.unexplained.join(", ")}`);
  return lines.join("\n");
}
