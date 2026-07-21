import type { ArtifactRef, ParseFailure } from "../types.js";

/**
 * Parsed .claude/settings.json, reduced to what the hook rules need: the shell
 * command strings from command-type hooks. Everything else in settings.json is
 * left to the raw matchers, which scan the bytes directly.
 *
 * Hooks nest as hooks.<Event>[] -> { matcher?, hooks: [ { type, command } ] }.
 * A command hook runs `command` on the given event; that string is what a
 * structured rule inspects (a raw matcher cannot, because in JSON the line
 * starts with the "command": key, not the shell command itself).
 */
export interface ParsedSettings {
  ref: ArtifactRef;
  /** The full file text, exactly as read. Raw matchers scan this. */
  source: string;
  /** Shell command strings from command-type hooks, in document order. */
  hookCommands: string[];
}

export type SettingsParseResult =
  | { ok: true; settings: ParsedSettings }
  | { ok: false; failure: ParseFailure };

const BOM = 0xfeff;

/**
 * Parse settings.json as strict JSON. The Claude Code runtime reads these files
 * strictly and rejects an invalid one as a whole, so we match that: a strict
 * parse that fails becomes a first-class failure, not a silent skip, and raw
 * matchers still scan every byte regardless.
 */
export function parseSettings(ref: ArtifactRef, source: string): SettingsParseResult {
  const text = source.charCodeAt(0) === BOM ? source.slice(1) : source;

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, failure: { path: ref.relPath, reason: `not valid JSON: ${messageOf(error)}` } };
  }

  if (!isRecord(data)) {
    return { ok: false, failure: { path: ref.relPath, reason: "top level is not a JSON object" } };
  }

  return { ok: true, settings: { ref, source, hookCommands: extractHookCommands(data.hooks) } };
}

function extractHookCommands(hooks: unknown): string[] {
  if (!isRecord(hooks)) return [];
  const commands: string[] = [];
  for (const groups of Object.values(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!isRecord(group) || !Array.isArray(group.hooks)) continue;
      for (const handler of group.hooks) {
        if (isRecord(handler) && handler.type === "command" && typeof handler.command === "string") {
          commands.push(handler.command);
        }
      }
    }
  }
  return commands;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
