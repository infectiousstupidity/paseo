import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

interface GitCommandRuntimeLog {
  submitted?: number;
  started?: number;
  completed?: number;
  failed?: number;
  timedOut?: number;
  active?: number;
  pending?: number;
  peakActive?: number;
  peakPending?: number;
  oldestPendingMs?: number;
  concurrencyLimit?: number;
  maxProcessesPerSecond?: number;
  operationsTop?: unknown;
  provenanceTop?: unknown;
  pendingProvenanceTop?: unknown;
  activeProvenanceTop?: unknown;
}

interface RuntimeMetricsLogRecord {
  msg?: string;
  time?: number | string;
  windowMs?: number;
  git?: {
    commands?: GitCommandRuntimeLog;
    workspaceService?: Record<string, unknown>;
  };
}

interface CliOptions {
  logPath: string;
  windows: number;
}

function parseArgs(argv: string[]): CliOptions {
  const paseoHome = process.env.PASEO_HOME?.trim();
  let logPath = paseoHome
    ? path.join(paseoHome, "daemon.log")
    : path.join(homedir(), ".paseo", "daemon.log");
  let windows = 3;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--log") {
      const value = argv[index + 1];
      if (!value) throw new Error("--log requires a path");
      // npm changes cwd to the selected workspace before running its script.
      // Resolve explicit relative paths from the directory where npm was invoked
      // so repo-root paths behave the way the caller expects.
      const invocationCwd = process.env.INIT_CWD?.trim() || process.cwd();
      logPath = path.resolve(invocationCwd, value);
      index += 1;
      continue;
    }
    if (arg === "--windows") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 120) {
        throw new Error("--windows must be an integer between 1 and 120");
      }
      windows = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        [
          "Usage: npm run analyze:git-runtime --workspace=@getpaseo/server -- [options]",
          "",
          "Options:",
          "  --log <path>       daemon.log path; relative paths resolve from the npm invocation directory",
          "                     (default: %PASEO_HOME%/daemon.log or ~/.paseo/daemon.log)",
          "  --windows <count>  number of 30s ws_runtime_metrics windows to aggregate (default: 3)",
          "",
        ].join("\n"),
      );
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { logPath, windows };
}

function asCountPairs(value: unknown): Array<[string, number]> {
  if (!Array.isArray(value)) return [];
  const pairs: Array<[string, number]> = [];
  for (const item of value) {
    if (
      Array.isArray(item) &&
      item.length >= 2 &&
      typeof item[0] === "string" &&
      typeof item[1] === "number" &&
      Number.isFinite(item[1])
    ) {
      pairs.push([item[0], item[1]]);
    }
  }
  return pairs;
}

function addCounts(target: Map<string, number>, pairs: Array<[string, number]>): void {
  for (const [key, count] of pairs) {
    target.set(key, (target.get(key) ?? 0) + count);
  }
}

function topCounts(counts: ReadonlyMap<string, number>, limit = 12): Array<[string, number]> {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit);
}

function formatCounts(counts: Array<[string, number]>): string[] {
  if (counts.length === 0) return ["  none"];
  return counts.map(([key, count], index) => `  ${index + 1}. ${key}: ${count}`);
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatWorkspaceService(metrics: Record<string, unknown> | undefined): string {
  if (!metrics) return "unavailable";
  const keys = [
    "workspaceTargetCount",
    "workspaceListenerCount",
    "repositoryTargetCount",
    "repositoryWorkspaceLinkCount",
    "workingTreeWatchTargetCount",
    "workingTreeWatchListenerCount",
    "workspaceRefreshInFlightCount",
    "workspaceRefreshQueuedCount",
    "workspaceRefreshAdmissionActiveCount",
    "workspaceRefreshAdmissionPendingCount",
    "fetchInFlightCount",
    "watcherErrorCallbackCount",
  ];
  return keys
    .filter((key) => typeof metrics[key] === "number")
    .map((key) => `${key}=${String(metrics[key])}`)
    .join(", ");
}

async function readRecentRuntimeMetrics(
  logPath: string,
  windows: number,
): Promise<RuntimeMetricsLogRecord[]> {
  await access(logPath);
  const recent: RuntimeMetricsLogRecord[] = [];
  const input = createReadStream(logPath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line.includes('"msg":"ws_runtime_metrics"')) continue;
    let record: RuntimeMetricsLogRecord;
    try {
      record = JSON.parse(line) as RuntimeMetricsLogRecord;
    } catch {
      continue;
    }
    if (record.msg !== "ws_runtime_metrics" || !record.git?.commands) continue;
    recent.push(record);
    if (recent.length > windows) recent.shift();
  }

  return recent;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const records = await readRecentRuntimeMetrics(options.logPath, options.windows);
  if (records.length === 0) {
    throw new Error(`No ws_runtime_metrics records with Git metrics found in ${options.logPath}`);
  }

  const provenance = new Map<string, number>();
  const operations = new Map<string, number>();
  let windowMs = 0;
  let submitted = 0;
  let started = 0;
  let completed = 0;
  let failed = 0;
  let timedOut = 0;
  let peakActive = 0;
  let peakPending = 0;
  let maxOldestPendingMs = 0;
  let lastCommands: GitCommandRuntimeLog | undefined;

  for (const record of records) {
    const commands = record.git?.commands;
    if (!commands) continue;
    lastCommands = commands;
    windowMs += numberOrZero(record.windowMs);
    submitted += numberOrZero(commands.submitted);
    started += numberOrZero(commands.started);
    completed += numberOrZero(commands.completed);
    failed += numberOrZero(commands.failed);
    timedOut += numberOrZero(commands.timedOut);
    peakActive = Math.max(peakActive, numberOrZero(commands.peakActive));
    peakPending = Math.max(peakPending, numberOrZero(commands.peakPending));
    maxOldestPendingMs = Math.max(maxOldestPendingMs, numberOrZero(commands.oldestPendingMs));
    addCounts(provenance, asCountPairs(commands.provenanceTop));
    addCounts(operations, asCountPairs(commands.operationsTop));
  }

  const last = records[records.length - 1];
  const lastGit = last.git?.commands;
  const seconds = Math.round(windowMs / 1000);
  const rate = windowMs > 0 ? submitted / (windowMs / 1000) : 0;

  const output = [
    "Paseo Git runtime analysis",
    `Log: ${options.logPath}`,
    `Windows: ${records.length} (~${seconds}s total)`,
    "",
    `Commands: submitted=${submitted}, started=${started}, completed=${completed}, failed=${failed}, timedOut=${timedOut}`,
    `Rate: ${rate.toFixed(1)} submitted/s`,
    `Queue: peakActive=${peakActive}, peakPending=${peakPending}, oldestPendingMax=${Math.round(maxOldestPendingMs)}ms`,
    lastCommands
      ? `Scheduler limits: ${numberOrZero(lastCommands.maxProcessesPerSecond)}/s, ${numberOrZero(lastCommands.concurrencyLimit)} concurrent`
      : "Scheduler limits: unavailable",
    "",
    "Top Git provenance (aggregated from each window's top list):",
    ...formatCounts(topCounts(provenance)),
    "",
    "Top Git operations (aggregated from each window's top list):",
    ...formatCounts(topCounts(operations)),
    "",
    "Last-window pending provenance:",
    ...formatCounts(asCountPairs(lastGit?.pendingProvenanceTop)),
    "",
    "Last-window active provenance:",
    ...formatCounts(asCountPairs(lastGit?.activeProvenanceTop)),
    "",
    `Workspace Git: ${formatWorkspaceService(last.git?.workspaceService)}`,
    "",
  ];

  process.stdout.write(output.join("\n"));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
