import { pipesDownloadIntoShell } from "./shell-shape.js";
import type { MatcherMatch } from "./types.js";

/**
 * Inspects command lines by their shape rather than by raw pattern. The one
 * check today is "download piped straight into a shell": curl into bash, or
 * PowerShell's iex around a web request. That shape runs code the author never
 * shows, fetched from a URL, with no chance to read it first.
 *
 * The shape test lives in shell-shape.ts, shared with the hooks matcher. A
 * benign "cat file | grep x" shares the pipe but not the shape, so it stays
 * quiet: the rule fires only when a downloader feeds a shell.
 */
export interface CommandTokenConfig {
  type: "command-token";
  detect: "pipe-to-shell";
}

const MAX_DETAIL_CHARS = 120;

export function matchCommandToken(source: string, config: CommandTokenConfig): MatcherMatch[] {
  if (config.detect !== "pipe-to-shell") return [];

  const matches: MatcherMatch[] = [];
  let lineStart = 0;

  for (const rawLine of splitKeepingOffsets(source)) {
    const line = rawLine.text;
    if (pipesDownloadIntoShell(line)) {
      const leading = line.length - line.trimStart().length;
      const trimmedEnd = line.trimEnd().length;
      matches.push({
        start: lineStart + leading,
        end: lineStart + trimmedEnd,
        detail: renderDetail(line.trim()),
      });
    }
    lineStart += rawLine.length;
  }

  return matches;
}

interface Line {
  text: string;
  /** Length including the trailing newline, so offsets stay aligned. */
  length: number;
}

function splitKeepingOffsets(source: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) {
      lines.push({ text: source.slice(start, i), length: i - start + 1 });
      start = i + 1;
    }
  }
  if (start < source.length) lines.push({ text: source.slice(start), length: source.length - start });
  return lines;
}

function renderDetail(command: string): string {
  const clipped =
    command.length > MAX_DETAIL_CHARS ? `${command.slice(0, MAX_DETAIL_CHARS)}...` : command;
  return `command pipes a download into a shell: ${clipped}`;
}
