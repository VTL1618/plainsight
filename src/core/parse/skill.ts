import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { ArtifactRef, ParseFailure } from "../types.js";
import { extractDocument, type FrontmatterBlock } from "./frontmatter.js";

export interface ParsedSkill {
  ref: ArtifactRef;
  /** The full file text, exactly as read. Matchers scan this. */
  source: string;
  /** Null when the file has no frontmatter block at all. */
  frontmatter: (FrontmatterBlock & { data: Record<string, unknown> }) | null;
  body: {
    text: string;
    /** 1-based line in the file where the body starts. */
    startLine: number;
    /** UTF-16 offset in `source` where the body starts. */
    offset: number;
    /** Markdown AST. Positions inside it are body-relative. */
    ast: Root;
  };
  hasBom: boolean;
}

export type SkillParseResult =
  | { ok: true; skill: ParsedSkill }
  | { ok: false; failure: ParseFailure };

const markdown = unified().use(remarkParse);

export function parseSkill(ref: ArtifactRef, source: string): SkillParseResult {
  const doc = extractDocument(source);

  if (doc.frontmatter.kind === "error") {
    return { ok: false, failure: { path: ref.relPath, reason: doc.frontmatter.reason } };
  }

  let frontmatter: ParsedSkill["frontmatter"] = null;
  if (doc.frontmatter.kind === "ok") {
    const { data } = doc.frontmatter.block;
    if (!isRecord(data)) {
      return {
        ok: false,
        failure: { path: ref.relPath, reason: "frontmatter is not a YAML map" },
      };
    }
    frontmatter = { ...doc.frontmatter.block, data };
  }

  return {
    ok: true,
    skill: {
      ref,
      source,
      frontmatter,
      body: {
        text: doc.body,
        startLine: doc.bodyStartLine,
        offset: doc.bodyOffset,
        ast: markdown.parse(doc.body),
      },
      hasBom: doc.hasBom,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
