import type { Position } from "./types.js";

/** UTF-16 offsets at which each line starts. Line 1 starts at offset 0. */
export function buildLineIndex(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
  }
  return starts;
}

/** Convert a UTF-16 offset into a 1-based line and column. */
export function positionAt(lineStarts: readonly number[], offset: number): Position {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((lineStarts[mid] ?? 0) <= offset) low = mid;
    else high = mid - 1;
  }
  return { line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
}
