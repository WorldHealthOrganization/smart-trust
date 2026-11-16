/**
 * Every skill that says a PERSON may invoke it, served as an MCP prompt.
 *
 * @module cat-harness/src/tools/skill-prompts
 *
 * Bean `j6t3`, option F, on the owner's choice of 2026-09-30 ("F + A").
 * Measured that day: 40 skills declare `user_invocable: true` and 3 could be
 * typed as a slash command. The declaration said a person may reach for the
 * skill; no host let them.
 *
 * ## Prompts, not tools — and that is the owner's rule, not a preference
 *
 * MCP has two primitives that look alike and are not. A **tool** is offered to
 * the model; a **prompt** is listed for the person, who picks one. Claude Code
 * renders a server's prompts as `/mcp__<server>__<name>` slash commands. So the
 * person-facing half of a skill is a prompt, and this module registers no tool.
 *
 * It also keeps the owner's 2026-09-21 ruling, *"keep tools and skills
 * separate!"*, by construction: nothing here mints a Tool node or writes into
 * `tools/`. A prompt is an INVOCATION of a skill — the skill's own body, sent
 * as the person's message — and the skill stays where it is declared.
 *
 * ## One derivation, two surfaces
 *
 * {@link userInvocableSkills} is also what `scripts/gen-skill-commands.ts`
 * reads to write `.claude/commands/` (option A). Two surfaces from one list is
 * the point: the 3-of-40 gap was two hand-kept surfaces drifting from the
 * declarations, and a third hand-kept one would drift the same way.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";

import { LOCAL_PACKAGES } from "../../scripts/skill-packages.js";

export {
  declaresUserInvocable,
  userInvocableSkills,
  type InvocableSkill,
  type InvocableSkillList,
} from "../../scripts/invocable-skills.js";
import { type InvocableSkill, userInvocableSkills } from "../../scripts/invocable-skills.js";

/** The message a prompt sends: the skill's own body, plus whatever the person typed after it. */
export function promptText(skill: InvocableSkill, args?: string): string {
  const body = readFileSync(skill.path, "utf8");
  const tail = args && args.trim() ? `\n\n## Arguments\n\n${args.trim()}\n` : "";
  return `Run the \`${skill.name}\` skill (package \`${skill.packageName}\`). Its instructions follow.\n\n${body}${tail}`;
}

/** Register one MCP prompt per `user_invocable` skill. Returns the names registered. */
export function registerSkillPrompts(server: McpServer, packages: Record<string, string> = LOCAL_PACKAGES): string[] {
  const { skills } = userInvocableSkills(packages);
  for (const skill of skills) {
    server.registerPrompt(
      skill.name,
      {
        title: skill.name,
        description: skill.summary,
        argsSchema: { args: z.string().optional().describe("What to run it on — passed through to the skill as written") },
      },
      ({ args }) => ({
        messages: [{ role: "user" as const, content: { type: "text" as const, text: promptText(skill, args) } }],
      }),
    );
  }
  return skills.map((s) => s.name);
}
