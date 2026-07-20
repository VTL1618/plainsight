import type { ParsedMcp } from "../parse/mcp.js";
import type { MatcherMatch } from "./types.js";

/**
 * Flags a literal credential written into an MCP server's `env` or `headers`
 * instead of an environment reference. Detection is by value shape, not key
 * name: a known token prefix (sk-, ghp_, xoxb-, AKIA, ...), a JWT, or a Bearer
 * header carrying a long literal token. An ordinary config value or a ${VAR}
 * reference stays quiet, which is what keeps this off long paths and log levels.
 *
 * The finding never reproduces the whole secret. Only a short masked prefix
 * reaches the detail, so the credential is not copied into SARIF or CI logs.
 *
 * The matcher takes no parameters; `mcp-secret` in rule.yaml is a bare type.
 */

// A value that pulls its content from the environment at launch: ${VAR}, $VAR, %VAR%.
const REFERENCE = /\$\{[^}]+\}|^\$[A-Za-z_][A-Za-z0-9_]*$|%[A-Za-z_][A-Za-z0-9_]*%/;
// Well-known credential prefixes. Literal alternation, linear time.
const KNOWN_PREFIX =
  /^(sk-ant-|sk-|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|glpat-|xox[baprs]-|AIza|AKIA|ASIA)/;
const JWT = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const TOKEN_CHARS = /^[A-Za-z0-9._~+/-]+=*$/;

export function matchMcpSecret(mcp: ParsedMcp): MatcherMatch[] {
  const matches: MatcherMatch[] = [];
  let cursor = 0;
  for (const server of mcp.servers) {
    for (const [key, value] of [...Object.entries(server.env), ...Object.entries(server.headers)]) {
      const masked = secretMask(value);
      if (masked === null) continue;
      const range = locateValue(mcp.source, value, cursor);
      cursor = range.end;
      matches.push({
        start: range.start,
        end: range.end,
        detail: `${key} holds a literal secret (${masked}), not an environment reference`,
      });
    }
  }
  return matches;
}

/** Returns a masked preview when the value is a recognizable secret, else null. */
function secretMask(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "" || REFERENCE.test(trimmed)) return null;

  const token = trimmed.replace(/^Bearer\s+/i, "");
  const hadBearer = token !== trimmed;
  if (REFERENCE.test(token)) return null;

  const isSecret =
    KNOWN_PREFIX.test(token) ||
    JWT.test(token) ||
    (hadBearer && token.length >= 16 && TOKEN_CHARS.test(token));
  if (!isSecret) return null;

  return `${hadBearer ? "Bearer " : ""}${token.slice(0, 6)}…`;
}

/** Point the finding at the value in the raw source, searching forward from a cursor. */
function locateValue(source: string, value: string, from: number): { start: number; end: number } {
  const idx = source.indexOf(value, from);
  if (idx >= 0) return { start: idx, end: idx + value.length };
  const first = source.indexOf(value);
  if (first >= 0) return { start: first, end: first + value.length };
  return { start: 0, end: 0 };
}
