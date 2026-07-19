import { z } from "zod";

/**
 * The rule.yaml contract. This schema is the contributor surface: its error
 * messages are the first thing a rule author sees when a field is wrong, so
 * every constraint carries a message written for a person, not a parser.
 * Unknown keys are rejected; a typo in a field name must fail loudly.
 */

const codepoint = z
  .string()
  .regex(/^U\+[0-9A-Fa-f]{4,6}$/, 'codepoints use the form "U+E0000"')
  .transform((value) => Number.parseInt(value.slice(2), 16));

const codepointRange = z
  .strictObject({ from: codepoint, to: codepoint })
  .refine((range) => range.from <= range.to, { message: "range start exceeds its end" });

export const unicodeRangeMatcherSchema = z.strictObject({
  type: z.literal("unicode-range"),
  ranges: z.array(codepointRange).min(1, "at least one codepoint range is required"),
  allow: z.literal("rgi-emoji-tag-sequences").optional(),
});

export const substringMatcherSchema = z.strictObject({
  type: z.literal("substring"),
  phrases: z.array(z.string().min(1, "phrases must not be empty")).min(1, "list at least one phrase"),
  caseSensitive: z.boolean().optional(),
});

export const urlTokenMatcherSchema = z.strictObject({
  type: z.literal("url-token"),
});

export const matcherSchema = z.discriminatedUnion("type", [
  unicodeRangeMatcherSchema,
  substringMatcherSchema,
  urlTokenMatcherSchema,
]);

const prose = z
  .string()
  .trim()
  .min(1, "must not be empty");

export const ruleSchema = z.strictObject({
  id: z
    .string()
    .regex(/^PS[1-6]-[a-z0-9]+(-[a-z0-9]+)*$/, 'rule IDs look like "PS2-unicode-tag-block"'),
  category: z
    .string()
    .regex(/^PS[1-6]-[a-z]+(-[a-z]+)*$/, 'categories look like "PS2-hidden-content"'),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: prose,
  description: prose,
  rationale: prose,
  remediation: prose,
  references: z.array(z.url()).min(1, "cite at least one reference"),
  targets: z.array(z.enum(["skill"])).min(1, "name at least one artifact type"),
  matcher: matcherSchema,
});

export type RuleDefinition = z.infer<typeof ruleSchema>;
export type MatcherConfig = z.infer<typeof matcherSchema>;
