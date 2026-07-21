import type { ArtifactRef, ParseFailure } from "../types.js";

/**
 * Validate a plugin marketplace manifest as JSON. Phase 6 scans manifests only
 * with raw rules (hidden content and injection text in free-text fields), so
 * there is no structured model to build yet; structured manifest analysis
 * (declared-source vs hosting-repo mismatch, and the like) is future work.
 *
 * The parse still runs for one reason: the same parser-differential discipline
 * as the MCP config. A manifest the runtime reads and we cannot is surfaced as
 * a failure rather than a silent skip, and raw matchers scan the bytes either
 * way, so hidden content in a file that defeats this parse is never exempted.
 */
export type ManifestParseResult = { ok: true } | { ok: false; failure: ParseFailure };

const BOM = 0xfeff;

export function parseManifest(ref: ArtifactRef, source: string): ManifestParseResult {
  const text = source.charCodeAt(0) === BOM ? source.slice(1) : source;
  try {
    JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, failure: { path: ref.relPath, reason: `not valid JSON: ${reason}` } };
  }
  return { ok: true };
}
