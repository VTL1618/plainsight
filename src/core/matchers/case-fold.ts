/**
 * ASCII-only case folding. Length is preserved exactly (each UTF-16 code unit
 * maps to one), so offsets into a folded string still point at the same
 * character in the original. Locale-aware lowercasing can change length (the
 * Turkish dotted I is the classic case) and would corrupt positions, so it is
 * never used for matching.
 */
export function asciiFold(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    out += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : value[i];
  }
  return out;
}
