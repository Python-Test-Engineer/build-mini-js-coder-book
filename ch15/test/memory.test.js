/**
 * memory.test.js - offline tests for memory parsing, caps, deduplication, search and prompt digest.
 *
 * These tests use node:test and node:assert. They never call the network and
 * never need an OpenRouter key: the model, filesystem roots and environment are
 * injected or stubbed. A failing test here means the chapter's contract has
 * drifted, not that the reader's setup is wrong.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Memory, parseMemory, formatEntry } from '../src/memory.js';


/**
 * Build an isolated temporary workspace so tests never touch the repository or a real home folder.
 */
function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-memory-'));
  const file = path.join(root, 'src', 'memory.md');
  return {
    root,
    file,
    memory: new Memory({ root, file, now: () => new Date('2025-02-03'), ...options }),
  };
}

test('parseMemory accepts bullets and ignores prose', () => {
  const entries = parseMemory([
    '# memory',
    'some prose',
    '- [pref] likes tea _(2025-01-02)_',
    '* [fix] use node --test',
    '  - [gotcha] windows cmd',
  ].join('\n'));
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], { tag: 'pref', text: 'likes tea', date: '2025-01-02' });
  assert.equal(entries[1].date, 'undated');
  assert.equal(formatEntry(entries[0]), '- [pref] likes tea _(2025-01-02)_');
});

test('remember survives a new Memory instance', () => {
  const { root, file } = fixture();
  const first = new Memory({ root, file, now: () => new Date('2025-02-03') });
  const result = first.remember('likes green tea', { tag: 'pref' });
  assert.equal(result.ok, true);
  assert.equal(result.total, 1);

  const second = new Memory({ root, file });
  const entries = second.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].text, 'likes green tea');
  assert.equal(entries[0].tag, 'pref');
  assert.equal(entries[0].date, '2025-02-03');
});

test('duplicates refresh the date instead of adding a bullet', () => {
  const { root, file } = fixture();
  let day = '2025-02-03';
  const memory = new Memory({ root, file, now: () => new Date(day) });
  memory.remember('likes tea');
  day = '2025-03-04';
  const second = memory.remember('likes   TEA ');
  assert.equal(second.duplicate, true);
  assert.equal(memory.entries().length, 1);
  assert.equal(memory.entries()[0].date, '2025-03-04');
});

test('maxEntries drops the oldest', () => {
  const { root, file } = fixture();
  const memory = new Memory({ root, file, maxEntries: 2 });
  memory.remember('one');
  memory.remember('two');
  const third = memory.remember('three');
  assert.equal(third.dropped, 1);
  assert.deepEqual(memory.entries().map((e) => e.text), ['two', 'three']);
});

test('a long memory is truncated to the per-entry cap', () => {
  const { root, file } = fixture();
  const memory = new Memory({ root, file, maxEntryChars: 10, rememberChars: 100 });
  const result = memory.remember('abcdefghijklmnop');
  assert.equal(result.entry.text, 'abcdefghij');
});

test('empty and whitespace notes are refused', () => {
  const { root, file } = fixture();
  const memory = new Memory({ root, file });
  assert.equal(memory.remember('   ').ok, false);
  assert.equal(memory.entries().length, 0);
});

test('digest is bounded, newest first and states the hidden count', () => {
  const { root, file } = fixture({ promptEntries: 2, promptChars: 80 });
  const memory = new Memory({ root, file, promptEntries: 2, promptChars: 80 });
  memory.remember('oldest');
  memory.remember('middle');
  memory.remember('newest');
  const digest = memory.digest();
  assert.match(digest, /newest/);
  assert.match(digest, /middle/);
  assert.doesNotMatch(digest, /oldest/);
  assert.match(digest, /1 older memory not shown/);
  assert.ok(digest.length <= 80 + 80);
});

test('an empty store has an empty digest and adds nothing', () => {
  const { memory } = fixture();
  assert.equal(memory.digest(), '');
  assert.equal(memory.summary(), 'src/memory.md (0 memories)');
});

test('forget removes matching entries', () => {
  const { root, file } = fixture();
  const memory = new Memory({ root, file });
  memory.remember('keep this');
  memory.remember('DROP that');
  assert.equal(memory.forget('drop'), 1);
  assert.deepEqual(memory.entries().map((e) => e.text), ['keep this']);
});

test('search is AND over words and newest first', () => {
  const { root, file } = fixture();
  const memory = new Memory({ root, file });
  memory.remember('tea with milk', { tag: 'pref' });
  memory.remember('tea with honey', { tag: 'pref' });
  memory.remember('coffee', { tag: 'pref' });
  const hits = memory.search('tea honey');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].text, 'tea with honey');
  assert.equal(memory.search('').length, 3);
});

test('hand edits are picked up immediately', () => {
  const { root, file } = fixture();
  const memory = new Memory({ root, file });
  memory.remember('one');
  fs.appendFileSync(file, '- [fact] added by hand _(2025-04-05)_\n');
  assert.deepEqual(memory.entries().map((e) => e.text), ['one', 'added by hand']);
});

test('summary counts memories and reports the newest date', () => {
  const { root, file } = fixture();
  const memory = new Memory({ root, file, now: () => new Date('2025-05-06') });
  memory.remember('x');
  assert.equal(memory.summary(), 'src/memory.md (1 memory, newest 2025-05-06)');
});
