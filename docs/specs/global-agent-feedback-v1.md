# Global agent feedback records — proposed v1 contract

Status: **design contract, not implemented** (2026-10-13). Used by [Agentation per-annotation agents](../plans/agentation-per-annotation-agents.md) and intended for later read-only Pivolution ingestion. The directory `~/.agents/` is a shared agent-tool convention; **`feedback/` and this format are project-defined, not an industry standard**.

## Ownership and location

- Canonical default: `~/.agents/feedback/` for the **OS user running the authorized record-writing service**. On Windows this normally means `%USERPROFILE%\.agents\feedback\`, on macOS/Linux `$HOME/.agents/feedback/`. Never expand `~` on a remote client and assume it names the daemon host.
- One project namespace: `~/.agents/feedback/<project-slug>/<stable-record-id>.md`, for example `seicho/<id>.md`. The directory is outside Git repositories, Pi sessions, `~/.pivolution/`, and SEICHO personal app data.
- For SEICHO-dispatched work, the **authenticated Paseo-side owner** is the sole writer for that record, if Task 01 proves it can safely persist there. SEICHO must retain unsent notes on connection/storage failure, not silently write an alternative authoritative copy. A different producer may use the same schema with its own uniquely identified records; no two writers may mutate one record concurrently.
- Machine-local does **not** imply cross-machine synchronization. A Paseo daemon on a different host writes to that host's home. An agent/Pivolution running elsewhere needs explicit authorized access or later configuration of additional read-only roots. No automatic sync, cross-host replication, or global shared DB in v1.
- Local private data only: do not automatically Git-add, push, publish, or upload records. Create private directories/files where supported; do not add screenshots, DOM, selected/nearby page text, tokens, credentials, or raw Pi transcripts.

## Document structure

One Markdown document per *source annotation identity*, not one per execution session, attempt, or updated comment. The first submitted snapshot is immutable; new explicit submissions become revision events in the **same** record. All structured fields and events are **versioned** and machine-readable; prose is for human review.

Recommended minimal layout (illustrative; values are examples, not existing results):

````markdown
---
schema: agent-feedback/v1
record_id: "record-unique-id"
source: "agentation"
source_session_id: "annotation-session-id"
source_annotation_id: "annotation-id"
project: "seicho"
repository: "infectiousstupidity/seicho"
screen: "inbox"
created_at: "2026-10-13T12:00:00Z"
---

# Inbox — navigation feedback

## Original feedback

> Replace the left-edge selection indicator with a navigation icon.

## History

```json
{"event_id":"unique-event-1","at":"2026-10-13T12:00:00Z","kind":"submitted","revision":"sha256:..."}
```

```json
{"event_id":"unique-event-2","at":"2026-10-13T12:05:00Z","kind":"investigation_started","revision":"sha256:...","paseo_agent_id":"...","pi_session_id":"..."}
```
````

The implementation must pick **one** precisely defined Markdown/structured-event serialization and test round-trip parsing; the nested fenced example above describes content, not a requirement to allow free-form code fences in user text. Use a constrained YAML-like frontmatter subset (scalar strings only), explicitly escaped user feedback as prose, and compact single-line JSON events inside fenced blocks. All untrusted fields must be escaped/bounded, including quotation marks, headings, `---`, code fences, line endings and Unicode. Do not put arbitrary source comments in machine-readable identity fields.

## Invariants

1. Stable `record_id` scoped by `source` + `source_session_id` + `source_annotation_id` + project/repository identity; do not silently combine separate users/machines. Changing feedback text changes its **revision**, not its logical annotation ID.
2. Preserve the initial exact comment as submitted (after documented normalization) and original source/screen/timestamp. Subsequent revisions append an explicit `revision_submitted` event with the new bounded comment and digest; do not overwrite the first comment.
3. Append only **logical events** such as `submitted`, `investigation_started`, `proposal_ready`, `approved`, `implementation_started`, `verification_passed`, `verification_failed`, `blocked`, `reopened`, or `cancelled`. Each has a unique event ID, timestamp, revision and optional evidence references. Derive current state from events; do not also maintain a conflicting status file/database. An agent exit or unverified test is never `verification_passed`.
4. Persist an accepted `submitted` record **before spawning**. Use the stable annotation/revision/phase dispatch key from the Paseo plan for idempotence; attach correlation/request ID and native child ID before acknowledging success. Where request outcome is uncertain, record `uncertain` rather than blindly retrying. History and dispatcher state should refer to the same authoritative record, not shadow copies.
5. Use a single-writer, atomic file replacement (temporary file, flush where feasible, rename) with conflict detection and no overwrite on identity mismatch. Reject duplicate `event_id`; stable ordering; protect against partial writes and restart. Avoid directory symlinks/path traversal. A file-system record alone is **not** a distributed queue and must not invent lost runtime success.
6. Store **references**, not duplicate transcripts: Paseo agent/session ID, native Pi session/child reference and optionally verified commit/path/check result. Exact source-backed correlation is preferred over timestamps or fuzzy matching.
7. Treat annotation comments as untrusted instructions, never execution authority. Human approval remains separate and authenticated. The record can preserve feedback without authorizing implementation.
8. Bound Markdown and event payload sizes; prevent personal content leakage in diagnostics. Keep historical records after resolution for audits, subject to an explicit future retention/deletion policy. Do not implement retention automation now.

## Pivolution boundary (future, not this task)

Pivolution may **read** these Markdown records as an additional, versioned evidence source, normalize compact facts into its existing `~/.pivolution/pivolution.sqlite3`, and correlate using stable Pi/Paseo identities. It must never rewrite these originals or count an annotation once per spawned session. Count logical annotations, explicit feedback revisions, and independent executions separately depending on the question; compute recurrence from complete populations, then select representative source-backed examples. No per-annotation LLM review, new Pivolution DB/service, or implementation of an ingest adapter until real records exist and a specific measurement needs it.
