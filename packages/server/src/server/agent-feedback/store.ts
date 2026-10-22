import { createHash, randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type FeedbackPhase = "investigate" | "implement";
export type FeedbackKind = "submitted" | "revision_submitted" | "spawn_requested" | "spawn_accepted"
  | "uncertain" | "proposal_ready" | "approved" | "implementation_started"
  | "verification_passed" | "verification_failed" | "failed" | "blocked" | "cancelled";
export interface FeedbackNote {
  sourceApp: "seicho-dev";
  sourceNamespace: string;
  annotationId: string;
  screen: string;
  comment: string;
}
export interface FeedbackEvent {
  eventId: string;
  at: string;
  kind: FeedbackKind;
  revision: string;
  phase?: FeedbackPhase;
  requestId?: string;
  parentAgentId?: string;
  parentSessionId?: string;
  runId?: string;
  proposal?: string;
  evidence?: string;
}
export interface FeedbackRecord {
  recordId: string;
  sourceNamespace: string;
  annotationId: string;
  screen: string;
  original: string;
  revisions: Array<{ digest: string; comment: string }>;
  events: FeedbackEvent[];
}
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const safeId = /^[a-zA-Z0-9_-]{1,100}$/;
const safeScreen = /^(?:today|planner|life|inbox|library|runner|workoutRunner|history|run|settings)$/;
const MAX_BYTES = 128 * 1024;
export function validateFeedbackNote(value: unknown): asserts value is FeedbackNote {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid annotation");
  const n = value as Record<string, unknown>;
  if (Object.keys(n).some((k) => !["sourceApp", "sourceNamespace", "annotationId", "screen", "comment"].includes(k)))
    throw Error("Unexpected annotation content");
  if (n.sourceApp !== "seicho-dev" || typeof n.sourceNamespace !== "string" || !safeId.test(n.sourceNamespace)
    || typeof n.annotationId !== "string" || !safeId.test(n.annotationId)
    || typeof n.screen !== "string" || !safeScreen.test(n.screen)
    || typeof n.comment !== "string" || n.comment.length > 1200 || !n.comment.trim()
    || /[\x00-\x08\x0b-\x1f\x7f]/.test(n.comment)) throw Error("Invalid annotation");
}
export function feedbackId(note: FeedbackNote): string {
  validateFeedbackNote(note);
  return digest(["agent-feedback/v1", "seicho", note.sourceNamespace, note.annotationId].join("\n")).slice(0, 40);
}
export function feedbackDigest(note: FeedbackNote): string {
  validateFeedbackNote(note);
  return "sha256:" + digest(JSON.stringify([note.screen, note.comment.replaceAll("\r\n", "\n").replaceAll("\r", "\n")]));
}
function folder(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { mode: 0o700 });
  const stat = lstatSync(dir);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error("Unsafe feedback directory");
  return realpathSync(dir);
}
function privateDirectory(home: string): string {
  return folder(path.join(folder(path.join(folder(path.join(folder(home), ".agents")), "feedback")), "seicho"));
}
function safeFile(file: string): string {
  if (existsSync(file)) {
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_BYTES) throw Error("Unsafe feedback record");
  }
  return file;
}
function markdown(record: FeedbackRecord): string {
  const q = (value: string) => value.split("\n").map((l) => "> " + l).join("\n");
  const events = record.events.map((e) => JSON.stringify(e)).join("\n");
  const text = [
    "---", 'schema: "agent-feedback/v1"', 'record_id: ' + JSON.stringify(record.recordId),
    'project: "seicho"', 'source: "agentation"',
    'source_namespace: ' + JSON.stringify(record.sourceNamespace),
    'source_annotation_id: ' + JSON.stringify(record.annotationId),
    'screen: ' + JSON.stringify(record.screen), "---", "",
    "# SEICHO annotation", "", "## Original feedback", "", q(record.original), "",
    ...record.revisions.slice(1).flatMap((r) => ["## Revision " + r.digest, "", q(r.comment), ""]),
    "## History", "", "```jsonl", events, "```", "",
    "<!-- agent-feedback-state/v1", JSON.stringify(record), "-->", "",
  ].join("\n");
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw Error("Feedback record exceeds limit");
  return text;
}
function parseRecord(text: string, expected: string): FeedbackRecord {
  const match = /\n<!-- agent-feedback-state\/v1\n([^\n]+)\n-->\n$/.exec(text);
  if (!match || !text.startsWith('---\nschema: "agent-feedback/v1"\n')) throw Error("Invalid feedback format");
  const record: FeedbackRecord = JSON.parse(match[1]!);
  if (record.recordId !== expected || !safeId.test(record.sourceNamespace)
    || !safeId.test(record.annotationId) || !safeScreen.test(record.screen)
    || !Array.isArray(record.revisions) || !Array.isArray(record.events)
    || record.revisions.length === 0 || record.revisions.length > 50
    || record.events.length > 250 || typeof record.original !== "string"
    || markdown(record) !== text) throw Error("Corrupt feedback record");
  return record;
}
function write(target: string, value: string, first: boolean): void {
  const temp = path.join(path.dirname(target), "." + randomUUID() + ".tmp");
  const fd = openSync(temp, "wx", 0o600);
  try { writeFileSync(fd, value, "utf8"); fsyncSync(fd); } finally { closeSync(fd); }
  try { if (first) linkSync(temp, target); else renameSync(temp, target); }
  finally { if (existsSync(temp)) unlinkSync(temp); }
}
export class FeedbackStore {
  constructor(private readonly home = homedir()) {}
  private file(id: string): string {
    if (!/^[0-9a-f]{40}$/.test(id)) throw Error("Invalid record ID");
    return safeFile(path.join(privateDirectory(this.home), id + ".md"));
  }
  private atomic<T>(file: string, fn: () => T): T {
    const lock = file + ".lock";
    const fd = openSync(lock, "wx", 0o600);
    try { return fn(); } finally { closeSync(fd); unlinkSync(lock); }
  }
  load(recordId: string): FeedbackRecord {
    return parseRecord(readFileSync(this.file(recordId), "utf8"), recordId);
  }
  submit(note: FeedbackNote): { record: FeedbackRecord; revision: string } {
    validateFeedbackNote(note);
    const id = feedbackId(note);
    const revision = feedbackDigest(note);
    const file = this.file(id);
    return this.atomic(file, () => {
      const comment = note.comment.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
      let record: FeedbackRecord;
      if (existsSync(file)) {
        record = this.load(id);
        if (record.sourceNamespace !== note.sourceNamespace || record.annotationId !== note.annotationId || record.screen !== note.screen)
          throw Error("Feedback identity collision");
        if (record.revisions.at(-1)?.digest === revision) return { record, revision };
        // A -> B -> A is a new explicit submission, not a silent overwrite.
        // Previously issued spawn request keys still remain non-retryable by digest.
        record.revisions.push({ digest: revision, comment });
        record.events.push({ eventId: randomUUID(), at: new Date().toISOString(), kind: "revision_submitted", revision });
      } else {
        record = { recordId: id, sourceNamespace: note.sourceNamespace,
          annotationId: note.annotationId, screen: note.screen, original: comment,
          revisions: [{ digest: revision, comment }],
          events: [{ eventId: randomUUID(), at: new Date().toISOString(), kind: "submitted", revision }] };
      }
      write(file, markdown(record), !existsSync(file));
      return { record, revision };
    });
  }

  /**
   * Claim one irreversible spawn attempt under the record lock.
   * Replaying the same note after a lost reply NEVER starts another child.
   */
  reserve(id: string, revision: string, phase: FeedbackPhase, requestId: string,
    parentAgentId: string, parentSessionId: string): boolean {
    const file = this.file(id);
    return this.atomic(file, () => {
      const record = this.load(id);
      if (record.revisions.at(-1)?.digest !== revision) throw Error("Stale feedback revision");
      if (record.events.some((event) => event.revision === revision && event.phase === phase &&
          event.kind === "spawn_requested")) return false;
      if (phase === "implement" && !record.events.some((event) => event.revision === revision &&
          event.kind === "approved")) throw Error("Implementation requires explicit approval");
      record.events.push({ eventId: randomUUID(), at: new Date().toISOString(),
        kind: "spawn_requested", phase, requestId, revision, parentAgentId, parentSessionId });
      write(file, markdown(record), false);
      return true;
    });
  }

  /** Conservative recovery: unknown/still-active children continue occupying slots across restart. */
  active(phase: FeedbackPhase): string[] {
    const root = privateDirectory(this.home);
    const busy: string[] = [];
    for (const entry of readdirSync(root)) {
      if (!/^[0-9a-f]{40}\.md$/.test(entry)) continue;
      const record = this.load(entry.slice(0, -3));
      const requests = record.events.filter(e => e.kind === "spawn_requested" && e.phase === phase);
      for (const request of requests) {
        const later = record.events.some(e => e.revision === request.revision &&
          ((phase === "investigate" && e.kind === "proposal_ready") ||
           (phase === "implement" && ["verification_passed", "verification_failed", "failed", "blocked", "cancelled"].includes(e.kind))));
        if (!later) { busy.push(record.recordId); break; }
      }
    }
    return busy;
  }

  append(id: string, input: Omit<FeedbackEvent, "eventId" | "at"> & { eventId?: string }): FeedbackRecord {
    const file = this.file(id);
    return this.atomic(file, () => {
      const record = this.load(id);
      if (!record.revisions.some((r) => r.digest === input.revision)) throw Error("Unknown revision");
      if (input.eventId && record.events.some((e) => e.eventId === input.eventId)) return record;
      record.events.push({ ...input, eventId: input.eventId ?? randomUUID(), at: new Date().toISOString() });
      write(file, markdown(record), false);
      return record;
    });
  }
}
