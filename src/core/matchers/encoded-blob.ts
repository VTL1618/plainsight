import { asciiFold } from "./case-fold.js";
import type { MatcherMatch } from "./types.js";

/**
 * Finds a long encoded blob sitting next to an instruction to decode and run
 * it. Either half alone is ordinary: a sample token is fine, and the word
 * "decode" is fine. Together they are the smuggling pattern, an opaque payload
 * the reviewer cannot read handed to the model with instructions to execute.
 *
 * The blob test requires a run that mixes upper case, lower case, and digits,
 * which is what a base64 payload looks like and what a hex hash or a lowercase
 * URL path does not, so checksums and links do not trip it.
 */
export interface EncodedBlobConfig {
  type: "encoded-blob";
  decodeWords: string[];
  executeWords: string[];
}

const BASE64_CHARS = /[A-Za-z0-9+/=]/;
const MIN_BLOB_LENGTH = 64;
const WINDOW = 200;

export function matchEncodedBlob(source: string, config: EncodedBlobConfig): MatcherMatch[] {
  const folded = asciiFold(source);
  const decodeWords = config.decodeWords.map((word) => asciiFold(word));
  const executeWords = config.executeWords.map((word) => asciiFold(word));

  const matches: MatcherMatch[] = [];
  for (const blob of findBlobs(source)) {
    const windowStart = Math.max(0, blob.start - WINDOW);
    const windowEnd = Math.min(source.length, blob.end + WINDOW);
    const context = folded.slice(windowStart, windowEnd);

    const decodes = decodeWords.some((word) => context.includes(word));
    const executes = executeWords.some((word) => context.includes(word));
    if (decodes && executes) {
      matches.push({
        start: blob.start,
        end: blob.end,
        detail: "an encoded blob sits next to an instruction to decode and run it",
      });
    }
  }
  return matches;
}

interface Blob {
  start: number;
  end: number;
}

function findBlobs(source: string): Blob[] {
  const blobs: Blob[] = [];
  let runStart = -1;
  for (let i = 0; i <= source.length; i++) {
    const inRun = i < source.length && BASE64_CHARS.test(source[i] ?? "");
    if (inRun && runStart === -1) {
      runStart = i;
    } else if (!inRun && runStart !== -1) {
      if (i - runStart >= MIN_BLOB_LENGTH && looksEncoded(source.slice(runStart, i))) {
        blobs.push({ start: runStart, end: i });
      }
      runStart = -1;
    }
  }
  return blobs;
}

/** A base64 payload of any length carries all three character classes; a hex hash or a URL path does not. */
function looksEncoded(run: string): boolean {
  let upper = false;
  let lower = false;
  let digit = false;
  for (let i = 0; i < run.length; i++) {
    const code = run.charCodeAt(i);
    if (code >= 65 && code <= 90) upper = true;
    else if (code >= 97 && code <= 122) lower = true;
    else if (code >= 48 && code <= 57) digit = true;
    if (upper && lower && digit) return true;
  }
  return false;
}
