import type { ArtifactRef, ParseFailure } from "../types.js";

/**
 * One server entry from an `.mcp.json` `mcpServers` map, normalized so matchers
 * read intent rather than JSON shape. A stdio server carries `command`/`args`/
 * `env`; a remote server carries `transport` (the `type` field), `url`, and
 * `headers`. Fields that are absent or the wrong type resolve to null or empty,
 * never throw: the input is hostile by assumption.
 */
export interface McpServer {
  name: string;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  /** The `type` field, e.g. "stdio", "sse", "http". Named to avoid ArtifactType confusion. */
  transport: string | null;
  url: string | null;
  headers: Record<string, string>;
}

export interface ParsedMcp {
  ref: ArtifactRef;
  /** The full file text, exactly as read. Raw matchers scan this. */
  source: string;
  servers: McpServer[];
}

export type McpParseResult =
  | { ok: true; mcp: ParsedMcp }
  | { ok: false; failure: ParseFailure };

const BOM = 0xfeff;

/**
 * Parse an `.mcp.json` config. Strict JSON on purpose: the parser choice is a
 * security decision (docs/decisions.md). A file the runtime reads leniently
 * (comments, trailing commas) and we read strictly is a parser differential, so
 * a strict parse that fails is surfaced as a first-class failure rather than a
 * silent skip. Raw matchers still scan the bytes regardless, so hidden content
 * in a file that defeats this parser is never exempted from detection.
 */
export function parseMcp(ref: ArtifactRef, source: string): McpParseResult {
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

  return { ok: true, mcp: { ref, source, servers: extractServers(data.mcpServers) } };
}

function extractServers(raw: unknown): McpServer[] {
  if (!isRecord(raw)) return [];
  const servers: McpServer[] = [];
  for (const [name, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    servers.push({
      name,
      command: typeof value.command === "string" ? value.command : null,
      args: stringArray(value.args),
      env: stringMap(value.env),
      transport: typeof value.type === "string" ? value.type : null,
      url: typeof value.url === "string" ? value.url : null,
      headers: stringMap(value.headers),
    });
  }
  return servers;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry;
    else if (typeof entry === "number" || typeof entry === "boolean") out[key] = String(entry);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
