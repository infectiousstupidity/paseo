/**
 * Task Agentation-01: disposable filesystem contract probe, NOT product wiring.
 * Run: node --test scripts/agentation-01-storage-proof.mjs
 * Tests only an isolated temporary home; it never writes to ~/.agents.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  openSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync,
  unlinkSync, writeFileSync, fsyncSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function validate(input) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(input.project ?? '')) throw Error('invalid project');
  for (const field of ['sourceNamespace', 'annotationId']) {
    if (typeof input[field] !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input[field])) {
      throw Error(`invalid ${field}`);
    }
  }
  if (typeof input.comment !== 'string' || !input.comment.trim() || input.comment.length > 1200 || /\0/.test(input.comment)) throw Error('invalid comment');
  if (typeof input.screen !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(input.screen)) throw Error('invalid screen');
}

function secureDirectory(folder) {
  if (existsSync(folder)) {
    if (lstatSync(folder).isSymbolicLink() || !lstatSync(folder).isDirectory()) throw Error('unsafe directory');
  } else {
    mkdirSync(folder, { mode: 0o700 });
  }
  return realpathSync(folder);
}

function writeTemp(folder, content) {
  const tmp = path.join(folder, `.${cryptoId()}.tmp`);
  const fd = openSync(tmp, 'wx', 0o600);
  try {
    writeFileSync(fd, content, 'utf8');
    fsyncSync(fd);
  } catch (error) {
    closeSync(fd);
    unlinkSync(tmp);
    throw error;
  }
  closeSync(fd);
  return tmp;
}

function cryptoId() { return randomUUID(); }
function digest(text) { return createHash('sha256').update(text).digest('hex'); }
function quote(text) { return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n').map(line => `> ${line}`).join('\n'); }

function createOrRevise(home, input) {
  validate(input);
  const root = secureDirectory(path.join(home, '.agents'));
  const feedback = secureDirectory(path.join(root, 'feedback'));
  const project = secureDirectory(path.join(feedback, input.project));
  const recordId = digest(`agentation\n${input.project}\n${input.sourceNamespace}\n${input.annotationId}`).slice(0, 40);
  const target = path.join(project, `${recordId}.md`);
  const revision = `sha256:${digest(JSON.stringify({ screen: input.screen, comment: input.comment }))}`;
  const metadata = { schema: 'agent-feedback/v1', record_id: recordId, source: 'agentation', source_namespace: input.sourceNamespace, source_annotation_id: input.annotationId, project: input.project, screen: input.screen };
  const header = `---\n${Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n# Feedback\n\n## Original feedback\n\n${quote(input.comment)}\n\n## History\n\n`;
  // Fixed timestamp for deterministic self-test. Production must use actual timestamps.
  const eventId = digest(recordId + '\n' + revision + '\nsubmitted');
  const event = { event_id: eventId, kind: 'submitted', revision };
  const eventText = `\`\`\`json\n${JSON.stringify(event)}\n\`\`\`\n`;
  const lock = `${target}.lock`;
  let lockFd;
  try { lockFd = openSync(lock, 'wx', 0o600); } catch { throw Error('record busy'); }
  try {
    if (existsSync(target)) {
      if (lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile()) throw Error('unsafe record');
      const old = readFileSync(target, 'utf8');
      if (!old.includes(`record_id: ${JSON.stringify(recordId)}`)) throw Error('record identity mismatch');
      if (old.includes(JSON.stringify(event))) return { target, recordId, action: 'unchanged' };
      const revisionEvent = { ...event, kind: 'revision_submitted', event_id: digest(recordId + '\n' + revision + '\nrevision_submitted') };
      const revised = `${old}\n## Revision\n\n${quote(input.comment)}\n\n\`\`\`json\n${JSON.stringify(revisionEvent)}\n\`\`\`\n`;
      const tmp = writeTemp(project, revised);
      try { renameSync(tmp, target); } finally { if (existsSync(tmp)) unlinkSync(tmp); }
      return { target, recordId, action: 'revised' };
    }
    const tmp = writeTemp(project, header + eventText);
    try {
      // Atomic no-clobber publication: the target is never half-written.
      linkSync(tmp, target);
    } finally { if (existsSync(tmp)) unlinkSync(tmp); }
    return { target, recordId, action: 'created' };
  } finally {
    closeSync(lockFd);
    unlinkSync(lock);
  }
}

function withHome(run) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'agentation-01-'));
  try { run(home); } finally { rmSync(home, { recursive: true, force: true }); }
}

const note = { project: 'seicho', sourceNamespace: 'owner-scoped-test-install', annotationId: 'note-1', screen: 'inbox', comment: 'Remove the line' };

test('one stable record; exact retry does not duplicate a submitted event', () => withHome(home => {
  const first = createOrRevise(home, note);
  const second = createOrRevise(home, note);
  assert.equal(first.action, 'created');
  assert.equal(second.action, 'unchanged');
  assert.equal(first.target, second.target);
  assert.equal((readFileSync(first.target, 'utf8').match(/"kind":"submitted"/g) ?? []).length, 1);
}));

test('changed comment appends a revision without erasing original', () => withHome(home => {
  const first = createOrRevise(home, note);
  const revised = createOrRevise(home, { ...note, comment: '# Do not overwrite\n```bad```' });
  assert.equal(revised.action, 'revised');
  assert.equal(revised.target, first.target);
  const content = readFileSync(first.target, 'utf8');
  assert.match(content, /> Remove the line/);
  assert.match(content, /> # Do not overwrite\n> ```bad```/);
  assert.equal((content.match(/"kind":"submitted"/g) ?? []).length, 1);
  assert.equal((content.match(/"kind":"revision_submitted"/g) ?? []).length, 1);
}));

test('different annotation/source scopes do not collapse', () => withHome(home => {
  const first = createOrRevise(home, note);
  const next = createOrRevise(home, { ...note, annotationId: 'note-2' });
  const other = createOrRevise(home, { ...note, sourceNamespace: 'other-install' });
  assert.notEqual(first.recordId, next.recordId);
  assert.notEqual(first.recordId, other.recordId);
}));

test('rejects traversal, symlinked feedback, and invalid home path', () => withHome(home => {
  assert.throws(() => createOrRevise(home, { ...note, project: '../bad' }), /invalid project/);
  mkdirSync(path.join(home, '.agents'));
  symlinkSync(os.tmpdir(), path.join(home, '.agents', 'feedback'));
  assert.throws(() => createOrRevise(home, note), /unsafe directory/);
  unlinkSync(path.join(home, '.agents', 'feedback'));
  writeFileSync(path.join(home, '.agents', 'feedback'), 'not a directory');
  assert.throws(() => createOrRevise(home, note), /unsafe directory/);
}));

test('record is private on POSIX; no files under real user home', () => withHome(home => {
  const result = createOrRevise(home, note);
  if (process.platform !== 'win32') assert.equal(lstatSync(result.target).mode & 0o777, 0o600);
  assert.ok(result.target.startsWith(home + path.sep));
}));
