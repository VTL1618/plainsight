/** A single hit produced by a matcher, in terms of UTF-16 offsets into the file source. */
export interface MatcherMatch {
  /** UTF-16 offset of the first matched character. */
  start: number;
  /** UTF-16 offset just past the last matched character. */
  end: number;
  /** Printable, bounded evidence for the finding. Invisible content is decoded or escaped here. */
  detail: string;
}
