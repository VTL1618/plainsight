import type { MatcherMatch } from "./types.js";

/**
 * Inspects command lines by their shape rather than by raw pattern. The one
 * check today is "download piped straight into a shell": curl into bash, or
 * PowerShell's iex around a web request. That shape runs code the author never
 * shows, fetched from a URL, with no chance to read it first.
 *
 * Splitting into a command name plus arguments is what keeps it precise. A
 * benign "cat file | grep x" shares the pipe but not the shape, so it stays
 * quiet: the rule fires only when a downloader feeds a shell.
 */
export interface CommandTokenConfig {
  type: "command-token";
  detect: "pipe-to-shell";
}

const DOWNLOADERS = new Set([
  "curl",
  "wget",
  "iwr",
  "irm",
  "invoke-webrequest",
  "invoke-restmethod",
]);

const SHELLS = new Set([
  "sh",
  "bash",
  "zsh",
  "dash",
  "ksh",
  "fish",
  "python",
  "python3",
  "ruby",
  "perl",
  "node",
  "pwsh",
  "powershell",
]);

// Word-boundary matched so "irm" does not fire inside "confirm" and "iex"
// does not fire inside "index". Both are literal alternations, so linear.
const SHELL_EVAL = /\b(?:iex|invoke-expression)\b/i;
const DOWNLOADER_WORD = /\b(?:curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b/i;

// Prompt and privilege prefixes that sit in front of the real command.
const SKIP_PREFIXES = new Set(["$", ">", "sudo", "&&", ";"]);

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

function pipesDownloadIntoShell(line: string): boolean {
  // PowerShell form: iex (irm https://x). No pipe, a downloader wrapped in an
  // evaluator, so it is checked on the whole line.
  if (SHELL_EVAL.test(line) && DOWNLOADER_WORD.test(line)) return true;

  // Unix form: a downloader segment piped into a shell segment.
  const segments = line.split("|");
  for (let i = 0; i < segments.length - 1; i++) {
    if (DOWNLOADERS.has(firstCommand(segments[i] ?? "")) && SHELLS.has(firstCommand(segments[i + 1] ?? ""))) {
      return true;
    }
  }
  return false;
}

function firstCommand(segment: string): string {
  for (const token of segment.split(/\s+/)) {
    const word = token.trim();
    if (word.length === 0) continue;
    if (SKIP_PREFIXES.has(word)) continue;
    // Strip a leading backtick or code-fence marker left by Markdown.
    return word.replace(/^`+/, "").toLowerCase();
  }
  return "";
}

function renderDetail(command: string): string {
  const clipped =
    command.length > MAX_DETAIL_CHARS ? `${command.slice(0, MAX_DETAIL_CHARS)}...` : command;
  return `command pipes a download into a shell: ${clipped}`;
}
