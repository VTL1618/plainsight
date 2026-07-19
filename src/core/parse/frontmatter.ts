import YAML from "yaml";

/**
 * Frontmatter extraction is written in-house instead of using gray-matter.
 * A scanner that parses frontmatter differently from the agent runtime hands
 * attackers a bypass (a parser differential), so this step stays small,
 * explicit, and covered by edge-case tests. See docs/decisions.md.
 */

export interface FrontmatterBlock {
  /** The YAML text between the delimiters, exactly as it appears in the file. */
  raw: string;
  /** UTF-16 offset in the original source where `raw` begins. */
  rawOffset: number;
  /** Parsed value. Untrusted input, so no shape is assumed here. */
  data: unknown;
  /** 1-based line of the opening delimiter. */
  startLine: number;
  /** 1-based line of the closing delimiter. */
  endLine: number;
}

export type FrontmatterResult =
  | { kind: "none" }
  | { kind: "ok"; block: FrontmatterBlock }
  | { kind: "error"; reason: string };

export interface ExtractedDocument {
  frontmatter: FrontmatterResult;
  /** Body text after the closing delimiter; the whole source when there is no frontmatter. */
  body: string;
  /** 1-based line in the original source where the body starts. */
  bodyStartLine: number;
  /** UTF-16 offset into the original source where the body starts. */
  bodyOffset: number;
  /** True when the file starts with a UTF-8 BOM (itself a signal; see PS2). */
  hasBom: boolean;
}

/** Opening delimiter: `---` at the very start of the file, trailing blanks tolerated. */
const OPEN_DELIMITER = /^---[ \t]*\r?\n/;
/** Closing delimiter: a line containing only `---`, trailing blanks tolerated. */
const CLOSE_DELIMITER = /^---[ \t]*$/;

export function extractDocument(source: string): ExtractedDocument {
  const hasBom = source.charCodeAt(0) === 0xfeff;
  // The BOM is skipped only for delimiter detection. All offsets and line
  // numbers keep referring to the original source so findings point at the
  // file as it exists on disk.
  const bomOffset = hasBom ? 1 : 0;
  const afterBom = hasBom ? source.slice(1) : source;

  const open = OPEN_DELIMITER.exec(afterBom);
  if (open === null) {
    return {
      frontmatter: { kind: "none" },
      body: source,
      bodyStartLine: 1,
      bodyOffset: 0,
      hasBom,
    };
  }

  // Scan line by line for the closing delimiter, tracking offsets manually so
  // CRLF and LF files both report exact positions.
  let lineStart = open[0].length;
  let line = 2;
  while (lineStart <= afterBom.length) {
    const newlineIndex = afterBom.indexOf("\n", lineStart);
    const lineEnd = newlineIndex === -1 ? afterBom.length : newlineIndex;
    const rawLine = afterBom.slice(lineStart, lineEnd);
    const lineText = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

    if (CLOSE_DELIMITER.test(lineText)) {
      const raw = afterBom.slice(open[0].length, lineStart);
      const rawOffset = bomOffset + open[0].length;
      const bodyOffset = bomOffset + (newlineIndex === -1 ? afterBom.length : newlineIndex + 1);
      const parsed = parseYamlBlock(raw);
      return {
        frontmatter:
          parsed.kind === "error"
            ? parsed
            : { kind: "ok", block: { raw, rawOffset, data: parsed.data, startLine: 1, endLine: line } },
        body: source.slice(bodyOffset),
        bodyStartLine: line + 1,
        bodyOffset,
        hasBom,
      };
    }

    if (newlineIndex === -1) break;
    lineStart = newlineIndex + 1;
    line += 1;
  }

  return {
    frontmatter: { kind: "error", reason: "frontmatter opened with --- but never closed" },
    body: "",
    bodyStartLine: 1,
    bodyOffset: source.length,
    hasBom,
  };
}

function parseYamlBlock(raw: string): { kind: "ok"; data: unknown } | { kind: "error"; reason: string } {
  // YAML.parse rejects duplicate keys by default. Keep it that way: duplicate
  // keys are a known parser-differential vector (YAML 1.1 and 1.2 runtimes
  // disagree on which value wins), so refusing to guess is the safe answer.
  try {
    const data: unknown = YAML.parse(raw);
    // An empty block (`---` immediately followed by `---`) parses to null;
    // normalize to an empty map, which is what it means in practice.
    return { kind: "ok", data: data ?? {} };
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    return { kind: "error", reason: `frontmatter is not valid YAML: ${message ?? "unknown error"}` };
  }
}
