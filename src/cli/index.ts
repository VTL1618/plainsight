import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { applyBaseline, DEFAULT_BASELINE_FILE, parseBaseline, serializeBaseline } from "../core/baseline.js";
import { toJson } from "../core/report/json.js";
import { toPretty } from "../core/report/pretty.js";
import { toSarif } from "../core/report/sarif.js";
import { loadRules } from "../core/rules.js";
import { defaultRulesDir, scan, type ScanResult } from "../core/scan.js";
import { DEFAULT_FAIL_ON, meetsThreshold, SEVERITIES } from "../core/severity.js";
import type { Severity } from "../core/types.js";

/** Everything the CLI touches, injected so it can run under test without real process state. */
export interface CliIo {
  cwd: string;
  out: (text: string) => void;
  err: (text: string) => void;
  isTty: boolean;
  env: Record<string, string | undefined>;
  version: string;
}

const FORMATS = ["pretty", "sarif", "json"] as const;
type Format = (typeof FORMATS)[number];

const EXIT_OK = 0;
const EXIT_FINDINGS = 1;
const EXIT_ERROR = 2;

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        format: { type: "string" },
        baseline: { type: "string" },
        "min-severity": { type: "string" },
        "fail-on": { type: "string" },
        out: { type: "string" },
        color: { type: "boolean" },
        "no-color": { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean" },
      },
    });
  } catch (error) {
    io.err(`${errorText(error)}\n`);
    return EXIT_ERROR;
  }

  const { values, positionals } = parsed;
  if (values.version === true) {
    io.out(`plainsight ${io.version}\n`);
    return EXIT_OK;
  }
  const command = positionals[0] ?? "help";
  if (values.help === true || command === "help") {
    io.out(helpText());
    return EXIT_OK;
  }

  switch (command) {
    case "scan":
      return runScan(positionals[1] ?? ".", values, io);
    case "explain":
      return runExplain(positionals[1], io);
    case "rules":
      return runRules(io);
    case "baseline":
      return runBaseline(positionals[1] ?? ".", values, io);
    default:
      io.err(`unknown command "${command}". Try: plainsight --help\n`);
      return EXIT_ERROR;
  }
}

type Values = Record<string, string | boolean | undefined>;

async function runScan(target: string, values: Values, io: CliIo): Promise<number> {
  const format = readFormat(values.format, io);
  if (format === null) return EXIT_ERROR;

  const minSeverity = readSeverity(values["min-severity"], io, "min-severity");
  if (minSeverity === false) return EXIT_ERROR;

  const failOn = readFailOn(values["fail-on"], io);
  if (failOn === false) return EXIT_ERROR;

  let result: ScanResult;
  try {
    result = await scan(path.resolve(io.cwd, target));
  } catch (error) {
    io.err(`scan failed: ${errorText(error)}\n`);
    return EXIT_ERROR;
  }

  if (typeof values.baseline === "string") {
    try {
      const set = parseBaseline(await readFile(path.resolve(io.cwd, values.baseline), "utf8"));
      result = applyBaseline(result, set);
    } catch (error) {
      io.err(`baseline error: ${errorText(error)}\n`);
      return EXIT_ERROR;
    }
  }

  if (minSeverity !== undefined) {
    result = { ...result, findings: result.findings.filter((f) => meetsThreshold(f.severity, minSeverity)) };
  }

  io.out(render(result, format, wantsColor(values, io), io));

  if (failOn === "never") return EXIT_OK;
  const blocking = result.findings.some((f) => meetsThreshold(f.severity, failOn));
  return blocking ? EXIT_FINDINGS : EXIT_OK;
}

function render(result: ScanResult, format: Format, color: boolean, io: CliIo): string {
  switch (format) {
    case "sarif":
      return `${JSON.stringify(toSarif(result, { toolVersion: io.version }), null, 2)}\n`;
    case "json":
      return `${JSON.stringify(toJson(result, { toolVersion: io.version }), null, 2)}\n`;
    case "pretty":
      return `${toPretty(result, { color, toolVersion: io.version })}\n`;
  }
}

async function runExplain(ruleId: string | undefined, io: CliIo): Promise<number> {
  if (ruleId === undefined) {
    io.err("usage: plainsight explain <ruleId>\n");
    return EXIT_ERROR;
  }
  const rules = await loadRules(defaultRulesDir());
  const rule = rules.find((r) => r.id === ruleId);
  if (rule === undefined) {
    io.err(`no rule with id "${ruleId}". Run "plainsight rules" to list them.\n`);
    return EXIT_ERROR;
  }
  const lines = [
    `${rule.id}  (${rule.severity})`,
    rule.title,
    "",
    rule.description,
    "",
    "Why it matters:",
    rule.rationale,
    "",
    "Fix:",
    rule.remediation,
    "",
    "References:",
    ...rule.references.map((ref) => `  ${ref}`),
    "",
  ];
  io.out(`${lines.join("\n")}\n`);
  return EXIT_OK;
}

async function runRules(io: CliIo): Promise<number> {
  const rules = await loadRules(defaultRulesDir());
  const width = rules.reduce((max, r) => Math.max(max, r.id.length), 0);
  for (const rule of rules) {
    io.out(`${rule.id.padEnd(width)}  ${rule.severity.padEnd(8)}  ${rule.title}\n`);
  }
  io.out(`\n${String(rules.length)} rules.\n`);
  return EXIT_OK;
}

async function runBaseline(target: string, values: Values, io: CliIo): Promise<number> {
  let result: ScanResult;
  try {
    result = await scan(path.resolve(io.cwd, target));
  } catch (error) {
    io.err(`scan failed: ${errorText(error)}\n`);
    return EXIT_ERROR;
  }
  const outPath = typeof values.out === "string" ? values.out : DEFAULT_BASELINE_FILE;
  const content = serializeBaseline(result);
  try {
    await writeFile(path.resolve(io.cwd, outPath), content);
  } catch (error) {
    io.err(`could not write baseline: ${errorText(error)}\n`);
    return EXIT_ERROR;
  }
  const count = result.findings.length + result.failures.length;
  io.out(`Wrote ${String(count)} fingerprint${count === 1 ? "" : "s"} to ${outPath}.\n`);
  return EXIT_OK;
}

function readFormat(value: string | boolean | undefined, io: CliIo): Format | null {
  if (value === undefined) return "pretty";
  if (typeof value === "string" && (FORMATS as readonly string[]).includes(value)) {
    return value as Format;
  }
  io.err(`--format must be one of ${FORMATS.join(", ")}\n`);
  return null;
}

/** Returns the severity, undefined when unset, or false on an invalid value. */
function readSeverity(value: string | boolean | undefined, io: CliIo, flag: string): Severity | undefined | false {
  if (value === undefined) return undefined;
  if (typeof value === "string" && (SEVERITIES as readonly string[]).includes(value)) {
    return value as Severity;
  }
  io.err(`--${flag} must be one of ${SEVERITIES.join(", ")}\n`);
  return false;
}

function readFailOn(value: string | boolean | undefined, io: CliIo): Severity | "never" | false {
  if (value === undefined) return DEFAULT_FAIL_ON;
  if (value === "never") return "never";
  const severity = readSeverity(value, io, "fail-on");
  if (severity === undefined) return DEFAULT_FAIL_ON;
  return severity;
}

function wantsColor(values: Values, io: CliIo): boolean {
  if (values["no-color"] === true) return false;
  if (values.color === true) return true;
  if (io.env.NO_COLOR !== undefined && io.env.NO_COLOR !== "") return false;
  if (io.env.FORCE_COLOR !== undefined && io.env.FORCE_COLOR !== "") return true;
  return io.isTty;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function helpText(): string {
  return [
    "plainsight - static security scanner for AI agent artifacts",
    "",
    "Usage:",
    "  plainsight scan [path]        scan a directory (default: .)",
    "  plainsight explain <ruleId>   show what a rule detects and how to fix it",
    "  plainsight rules              list every rule",
    "  plainsight baseline [path]    write accepted findings to a baseline file",
    "",
    "Scan options:",
    "  --format pretty|sarif|json    output format (default: pretty)",
    "  --baseline <file>             suppress findings listed in a baseline",
    "  --min-severity <sev>          hide findings below this severity",
    "  --fail-on <sev>|never         exit 1 at this severity or above (default: high)",
    "  --no-color                    disable color output",
    "",
    "Exit codes: 0 clean, 1 blocking findings, 2 usage or runtime error.",
    "",
  ].join("\n");
}
