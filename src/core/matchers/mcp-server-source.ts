import type { McpServer, ParsedMcp } from "../parse/mcp.js";
import type { MatcherMatch } from "./types.js";

/**
 * Inspects how an MCP server is reached or launched. Two checks, selected by
 * `detect`:
 *  - insecure-transport: a remote server addressed over http:// (loopback
 *    exempt), so its tool traffic travels in the clear.
 *  - git-source: a server launched from a mutable git reference (github:,
 *    git+, a .git URL) rather than a published package, so the code that runs
 *    can change after review. A bare npm package name is not flagged; only a
 *    repository fetch is.
 */
export interface McpServerSourceConfig {
  type: "mcp-server-source";
  detect: "insecure-transport" | "git-source";
}

const GIT_SPEC = /^(?:github:|gitlab:|bitbucket:|git\+|git@)/i;
const GIT_URL = /^https?:\/\/\S+\.git(?:$|[?#/])/i;

export function matchMcpServerSource(mcp: ParsedMcp, config: McpServerSourceConfig): MatcherMatch[] {
  const matches: MatcherMatch[] = [];
  let cursor = 0;
  for (const server of mcp.servers) {
    const hit = config.detect === "insecure-transport" ? insecureUrl(server) : gitSource(server);
    if (hit === null) continue;
    const range = locate(mcp.source, hit.token, cursor);
    cursor = range.end;
    matches.push({ start: range.start, end: range.end, detail: hit.detail });
  }
  return matches;
}

function insecureUrl(server: McpServer): { token: string; detail: string } | null {
  if (server.url === null || !/^http:\/\//i.test(server.url)) return null;
  const host = server.url.replace(/^http:\/\//i, "").split(/[/:?#]/, 1)[0] ?? "";
  if (isLoopback(host)) return null;
  return { token: server.url, detail: `${server.name} connects over http://, not https (${server.url})` };
}

function gitSource(server: McpServer): { token: string; detail: string } | null {
  for (const arg of server.args) {
    if (GIT_SPEC.test(arg) || GIT_URL.test(arg)) {
      return { token: arg, detail: `${server.name} runs code fetched from a git source (${arg})` };
    }
  }
  return null;
}

function isLoopback(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]" || h.endsWith(".localhost");
}

function locate(source: string, token: string, from: number): { start: number; end: number } {
  const idx = source.indexOf(token, from);
  if (idx >= 0) return { start: idx, end: idx + token.length };
  const first = source.indexOf(token);
  if (first >= 0) return { start: first, end: first + token.length };
  return { start: 0, end: 0 };
}
