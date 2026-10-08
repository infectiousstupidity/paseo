import { open, readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type {
  ImportableProviderSession,
  ListImportableSessionsOptions,
} from "../../agent-sdk-types.js";
import type { ProviderRuntimeSettings } from "../../provider-launch-config.js";
import { createRealpathAwarePathMatcher } from "../../../../utils/path.js";

const PI_CONFIG_DIR_NAME = ".pi";
const PI_AGENT_DIR_ENV = "PI_CODING_AGENT_DIR";
const PI_SESSION_DIR_ENV = "PI_CODING_AGENT_SESSION_DIR";
// Import listing intentionally bounds header parsing to this window. Sessions
// with unusually large preambles may omit their first-prompt preview.
const HEAD_BYTES = 64 * 1024;
const TAIL_BYTES = 256 * 1024;
const FULL_SCAN_LINE_LIMIT = 2_000;
// Rank all discovered files cheaply, then parse only a bounded recent window.
const IMPORT_CANDIDATE_OVERSCAN = 40;
const IMPORT_CANDIDATE_MIN = 400;
const DIRECTORY_READ_CONCURRENCY = 16;
const FILE_STAT_CONCURRENCY = 32;

interface PiSessionDescriptorOptions extends ListImportableSessionsOptions {
  sessionDir?: string;
  runtimeSettings?: ProviderRuntimeSettings;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

interface PiSessionHeader {
  sessionId: string;
  cwd: string;
  createdAt: Date | null;
}

interface PiSessionTail {
  title: string | null;
  lastActivityAt: Date | null;
  lastUserMessage: string | null;
  model: string | null;
  thinkingOptionId: string | null;
}

interface PiSessionHead {
  title: string | null;
  firstUserMessage: string | null;
  model: string | null;
  thinkingOptionId: string | null;
}

interface PiSessionDescriptor {
  cwd: string;
  title: string | null;
  firstUserMessage: string | null;
  lastUserMessage: string | null;
  lastActivityAt: Date;
  model: string | null;
  thinkingOptionId: string | null;
}
interface RankedSessionFile {
  file: string;
  mtime: Date;
  size: number;
}

export interface PiImportSessionConfig {
  model?: string;
  thinkingOptionId?: string;
}

export async function listPiImportableSessions(
  options: PiSessionDescriptorOptions = {},
): Promise<ImportableProviderSession[]> {
  const sessionsDir = await resolvePiSessionsDir(options);
  const files = await walkJsonlFiles(sessionsDir);
  const pathMatches = options.cwd ? createRealpathAwarePathMatcher(options.cwd) : null;
  const cwdMatches = new Map<string, boolean>();
  const matchesCwd = pathMatches
    ? (candidate: string): boolean => {
        const cached = cwdMatches.get(candidate);
        if (cached !== undefined) return cached;
        const matches = pathMatches(candidate);
        cwdMatches.set(candidate, matches);
        return matches;
      }
    : null;
  const limit = options.limit ?? 20;
  const query = options.query?.trim().toLowerCase();
  const ranked = await rankSessionFilesByMtime(files);
  const candidateLimit = Math.min(
    options.scanLimit ?? Math.max(limit * IMPORT_CANDIDATE_OVERSCAN, IMPORT_CANDIDATE_MIN),
    500,
  );
  // Pi applies search to each descriptor as it scans. A fixed 500-file window
  // can silently hide older matching sessions, so search continues until the
  // requested number of matches is found or all candidates are inspected.
  const candidates =
    query || (options.scanLimit === undefined && matchesCwd)
      ? ranked
      : ranked.slice(0, candidateLimit);
  const sessions: ImportableProviderSession[] = [];

  for (const entry of candidates) {
    const session = await readPiImportableSession(entry, matchesCwd);
    if (!session || (query && !matchesPiSessionQuery(session, query))) continue;
    sessions.push(session);
    if (sessions.length >= limit) {
      break;
    }
  }

  return sessions.sort(
    (left, right) => right.lastActivityAt.getTime() - left.lastActivityAt.getTime(),
  );
}

function matchesPiSessionQuery(session: ImportableProviderSession, query: string): boolean {
  const cwdBasename = path.posix.basename(session.cwd.replaceAll("\\", "/"));
  return [
    session.title,
    session.firstPromptPreview,
    session.lastPromptPreview,
    cwdBasename,
  ].some((value) => value?.toLowerCase().includes(query));
}

export async function readPiImportSessionConfig(filePath: string): Promise<PiImportSessionConfig> {
  const descriptor = await readPiSessionDescriptor(filePath);
  if (!descriptor) return {};
  return toPiImportSessionConfig(descriptor);
}

async function resolvePiSessionsDir(options: PiSessionDescriptorOptions): Promise<string> {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? homedir();
  const baseDir = options.cwd ?? process.cwd();

  if (options.sessionDir?.trim()) {
    return resolveConfigPath(options.sessionDir, { baseDir, homeDir });
  }

  const agentDir = resolvePiAgentDir({ runtimeSettings: options.runtimeSettings, env, homeDir });

  const envSessionDir =
    options.runtimeSettings?.env?.[PI_SESSION_DIR_ENV] ?? env[PI_SESSION_DIR_ENV];
  if (envSessionDir?.trim()) {
    return resolveConfigPath(envSessionDir, { baseDir, homeDir });
  }

  const settingsSessionDir = await readConfiguredSessionDir({
    agentDir,
    cwd: options.cwd,
  });
  if (settingsSessionDir?.trim()) {
    return resolveConfigPath(settingsSessionDir, { baseDir, homeDir });
  }

  return path.join(agentDir, "sessions");
}

function resolvePiAgentDir(input: {
  runtimeSettings?: ProviderRuntimeSettings;
  env: NodeJS.ProcessEnv;
  homeDir: string;
}): string {
  const configured = input.runtimeSettings?.env?.[PI_AGENT_DIR_ENV] ?? input.env[PI_AGENT_DIR_ENV];
  if (configured?.trim()) {
    return resolveConfigPath(configured, { baseDir: process.cwd(), homeDir: input.homeDir });
  }
  return path.join(input.homeDir, PI_CONFIG_DIR_NAME, "agent");
}

async function readConfiguredSessionDir(input: {
  agentDir: string;
  cwd: string | undefined;
}): Promise<string | null> {
  const values = await Promise.all([
    readSessionDirFromSettings(path.join(input.agentDir, "settings.json")),
    input.cwd
      ? readSessionDirFromSettings(path.join(input.cwd, PI_CONFIG_DIR_NAME, "settings.json"))
      : null,
  ]);
  return values[1] ?? values[0] ?? null;
}

async function readSessionDirFromSettings(settingsPath: string): Promise<string | null> {
  try {
    const parsed = JSON.parse(await readFile(settingsPath, "utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const sessionDir = Reflect.get(parsed, "sessionDir");
    return typeof sessionDir === "string" && sessionDir.trim() ? sessionDir : null;
  } catch {
    return null;
  }
}

function resolveConfigPath(value: string, options: { baseDir: string; homeDir: string }): string {
  if (value === "~") {
    return options.homeDir;
  }
  if (value.startsWith("~/")) {
    return path.join(options.homeDir, value.slice(2));
  }
  return path.isAbsolute(value) ? value : path.resolve(options.baseDir, value);
}

async function walkJsonlFiles(root: string): Promise<string[]> {
  const pendingDirectories = [root];
  const files: string[] = [];

  // Bound concurrent readdir calls across the entire walk, including nested directories.
  for (let index = 0; index < pendingDirectories.length; index += DIRECTORY_READ_CONCURRENCY) {
    const directories = pendingDirectories.slice(index, index + DIRECTORY_READ_CONCURRENCY);
    const batches = await Promise.all(
      directories.map(async (directory) => {
        try {
          return await readdir(directory, { withFileTypes: true });
        } catch {
          return [];
        }
      }),
    );

    for (let offset = 0; offset < directories.length; offset += 1) {
      const directory = directories[offset];
      if (!directory) continue;
      for (const entry of batches[offset] ?? []) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          pendingDirectories.push(entryPath);
        } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
          files.push(entryPath);
        }
      }
    }
  }

  return files;
}

async function rankSessionFilesByMtime(files: string[]): Promise<RankedSessionFile[]> {
  const ranked: RankedSessionFile[] = [];

  // Batches bound filesystem pressure without changing the ranked-file result set.
  for (let index = 0; index < files.length; index += FILE_STAT_CONCURRENCY) {
    const batch = await Promise.all(
      files.slice(index, index + FILE_STAT_CONCURRENCY).map(async (file) => {
        try {
          const stats = await stat(file);
          return { file, mtime: stats.mtime, size: stats.size };
        } catch {
          return null;
        }
      }),
    );
    for (const entry of batch) {
      if (entry) ranked.push(entry);
    }
  }

  return ranked.sort((left, right) => right.mtime.getTime() - left.mtime.getTime());
}

async function readPiImportableSession(
  entry: RankedSessionFile,
  matchesCwd: ((candidate: string) => boolean) | null,
): Promise<ImportableProviderSession | null> {
  const descriptor = await readPiSessionDescriptor(entry.file, matchesCwd, entry);
  if (!descriptor) return null;

  return {
    providerHandleId: entry.file,
    cwd: descriptor.cwd,
    title: descriptor.title,
    firstPromptPreview: normalizePromptPreview(descriptor.firstUserMessage),
    lastPromptPreview: normalizePromptPreview(
      descriptor.lastUserMessage ?? descriptor.firstUserMessage,
    ),
    lastActivityAt: descriptor.lastActivityAt,
  };
}

async function readPiSessionDescriptor(
  filePath: string,
  matchesCwd?: ((candidate: string) => boolean) | null,
  rankedFile?: RankedSessionFile,
): Promise<PiSessionDescriptor | null> {
  const headChunk = await readHeadChunk(filePath);
  if (!headChunk) return null;
  const header = parseSessionHeader(headChunk.split(/\r?\n/u, 1)[0]?.trim() ?? "");
  // Scoped listings can discard unrelated sessions without reading their tails.
  if (!header || (matchesCwd && !matchesCwd(header.cwd))) return null;

  const tail = await readTail(filePath, rankedFile?.size).catch(() => "");
  const tailInfo = parseSessionTail(tail);
  const headInfo = parseSessionHeadFromChunk(headChunk);
  const title = tailInfo.title ?? headInfo.title ?? headInfo.firstUserMessage;
  const model = tailInfo.model ?? headInfo.model;
  const thinkingOptionId = tailInfo.thinkingOptionId ?? headInfo.thinkingOptionId;
  const lastActivityAt =
    tailInfo.lastActivityAt ??
    rankedFile?.mtime ??
    (await readFileMtime(filePath)) ??
    header.createdAt ??
    new Date(0);

  return {
    cwd: header.cwd,
    title,
    firstUserMessage: headInfo.firstUserMessage,
    lastUserMessage: tailInfo.lastUserMessage,
    lastActivityAt,
    model,
    thinkingOptionId,
  };
}

function toPiImportSessionConfig(descriptor: PiSessionDescriptor): PiImportSessionConfig {
  return {
    ...(descriptor.model ? { model: descriptor.model } : {}),
    ...(descriptor.thinkingOptionId ? { thinkingOptionId: descriptor.thinkingOptionId } : {}),
  };
}

async function readHeadChunk(filePath: string): Promise<string | null> {
  const handle = await open(filePath, "r").catch(() => null);
  if (!handle) return null;
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead <= 0) return null;
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function parseSessionHeadFromChunk(chunk: string): PiSessionHead {
  let title: string | null = null;
  let firstUserMessage: string | null = null;
  let model: string | null = null;
  let thinkingOptionId: string | null = null;
  let lineCount = 0;

  for (const rawLine of chunk.split(/\r?\n/u)) {
    lineCount += 1;
    const entry = parseJsonRecord(rawLine.trim());
    if (!entry) continue;

    if (entry.type === "session_info") {
      title = readNonEmptyString(entry.name) ?? title;
    }
    model = extractModel(entry) ?? model;
    thinkingOptionId = extractThinkingOptionId(entry) ?? thinkingOptionId;

    if (!firstUserMessage && entry.type === "message" && isRecord(entry.message)) {
      if (entry.message.role === "user") {
        firstUserMessage = extractMessageText(entry.message.content);
      }
    }

    if (title && firstUserMessage && model && thinkingOptionId) {
      break;
    }
    if (lineCount >= FULL_SCAN_LINE_LIMIT && firstUserMessage) {
      break;
    }
  }

  return { title, firstUserMessage, model, thinkingOptionId };
}

async function readTail(filePath: string, fileSize?: number): Promise<string> {
  const size = fileSize ?? (await stat(filePath)).size;
  const start = Math.max(0, size - TAIL_BYTES);
  const length = size - start;
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function readFileMtime(filePath: string): Promise<Date | null> {
  try {
    return (await stat(filePath)).mtime;
  } catch {
    return null;
  }
}

function parseSessionHeader(firstLine: string): PiSessionHeader | null {
  const entry = parseJsonRecord(firstLine);
  if (!entry || entry.type !== "session") return null;
  const sessionId = typeof entry.id === "string" ? entry.id : null;
  const cwd = typeof entry.cwd === "string" ? entry.cwd : null;
  if (!sessionId || !cwd) return null;
  const createdAt = parseDate(entry.timestamp);
  return { sessionId, cwd, createdAt };
}

function parseSessionTail(tail: string): PiSessionTail {
  const lines = tail.split(/\r?\n/u);
  let title: string | null = null;
  let lastActivityAt: Date | null = null;
  let fallbackTimestamp: Date | null = null;
  let lastUserMessage: string | null = null;
  let model: string | null = null;
  let thinkingOptionId: string | null = null;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const entry = parseJsonRecord(lines[index].trim());
    if (!entry) continue;

    if (!title && entry.type === "session_info") {
      title = readNonEmptyString(entry.name);
    }
    if (!model) {
      model = extractModel(entry);
    }

    if (!thinkingOptionId) {
      thinkingOptionId = extractThinkingOptionId(entry);
    }

    const entryTimestamp = parseDate(entry.timestamp);
    if (!fallbackTimestamp && entryTimestamp) {
      fallbackTimestamp = entryTimestamp;
    }

    if (entry.type !== "message") continue;

    if (!lastActivityAt && entryTimestamp) {
      lastActivityAt = entryTimestamp;
    }

    if (!lastUserMessage && isRecord(entry.message) && entry.message.role === "user") {
      lastUserMessage = extractMessageText(entry.message.content);
    }
  }

  return {
    title,
    lastActivityAt: lastActivityAt ?? fallbackTimestamp,
    lastUserMessage,
    model,
    thinkingOptionId,
  };
}

function extractModel(entry: Record<string, unknown>): string | null {
  if (entry.type === "model_change") {
    return buildModelId(entry.provider, entry.modelId);
  }

  if (entry.type === "message" && isRecord(entry.message)) {
    return buildModelId(entry.message.provider, entry.message.model);
  }

  return null;
}

function extractThinkingOptionId(entry: Record<string, unknown>): string | null {
  return entry.type === "thinking_level_change" ? readNonEmptyString(entry.thinkingLevel) : null;
}

function buildModelId(provider: unknown, modelId: unknown): string | null {
  const providerName = readNonEmptyString(provider);
  const modelName = readNonEmptyString(modelId);
  if (!providerName || !modelName) {
    return null;
  }
  return `${providerName}/${modelName}`;
}

function parseJsonRecord(line: string): Record<string, unknown> | null {
  if (!line) return null;
  try {
    const parsed = JSON.parse(line) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePromptPreview(text: string | null): string | null {
  const normalized = text?.trim().replace(/\s+/g, " ") ?? "";
  if (!normalized) return null;
  return normalized.length > 160 ? normalized.slice(0, 160) : normalized;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractMessageText(content: unknown): string | null {
  if (typeof content === "string") {
    return content.trim() || null;
  }
  if (!Array.isArray(content)) {
    return null;
  }
  const text = content
    .flatMap((part) =>
      isRecord(part) && part.type === "text" && typeof part.text === "string" ? [part.text] : [],
    )
    .join("\n\n")
    .trim();
  return text || null;
}
