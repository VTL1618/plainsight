/**
 * The "download piped into a shell" shape test, shared by two matchers:
 * command-token reads it off raw source lines (skills, slash commands), and
 * hooks-command reads it off command strings pulled from parsed settings.json.
 * One definition so both agree on what curl-into-bash looks like.
 */

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

export function pipesDownloadIntoShell(line: string): boolean {
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
