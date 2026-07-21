import type { ParsedSettings } from "../parse/settings.js";
import { pipesDownloadIntoShell } from "./shell-shape.js";
import type { MatcherMatch } from "./types.js";

/**
 * Flags a hook whose command downloads code and pipes it into a shell. This is
 * the structured twin of command-token: a raw matcher cannot read the command
 * out of JSON (the line starts with the "command": key), so the command string
 * is pulled from the parsed settings and the same shape test runs on it.
 *
 * A hook runs automatically on an event, without the model choosing to, so a
 * curl-into-bash hook is arguably worse than the same line in a skill.
 */
export interface HooksCommandConfig {
  type: "hooks-command";
  detect: "pipe-to-shell";
}

const MAX_DETAIL_CHARS = 120;

export function matchHooksCommand(settings: ParsedSettings, config: HooksCommandConfig): MatcherMatch[] {
  if (config.detect !== "pipe-to-shell") return [];

  const matches: MatcherMatch[] = [];
  let cursor = 0;
  for (const command of settings.hookCommands) {
    const hit = command.split("\n").find((line) => pipesDownloadIntoShell(line));
    if (hit === undefined) continue;
    const range = locate(settings.source, command, cursor);
    cursor = range.end;
    matches.push({ start: range.start, end: range.end, detail: renderDetail(hit.trim()) });
  }
  return matches;
}

function renderDetail(command: string): string {
  const clipped =
    command.length > MAX_DETAIL_CHARS ? `${command.slice(0, MAX_DETAIL_CHARS)}...` : command;
  return `a hook command pipes a download into a shell: ${clipped}`;
}

function locate(source: string, command: string, from: number): { start: number; end: number } {
  const idx = source.indexOf(command, from);
  if (idx >= 0) return { start: idx, end: idx + command.length };
  const first = source.indexOf(command);
  if (first >= 0) return { start: first, end: first + command.length };
  return { start: 0, end: 0 };
}
