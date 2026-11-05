/**
 * memory.js - durable, file-backed long-term memory.
 *
 * Entries are Markdown bullets with a tag and an ISO date. The file stays
 * human-editable on purpose: a reader can open it, understand it and fix it.
 * Parsing is forgiving; writing is bounded by maxEntries and per-entry caps so
 * memory can never grow without limit. digest() produces the small, newest-first
 * slice injected into the system prompt; recall() searches the full file.
 */

import fs from 'node:fs';
import path from 'node:path';


/**
 * The memory tags the harness understands: fact, preference, fix and gotcha.
 */
export const TAGS = new Set(['fact', 'pref', 'fix', 'gotcha']);

const normalise = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

const dateStamp = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};


/**
 * Parse the Markdown memory file into { tag, text, date } entries. Lines that do not look like entries are ignored, so prose and headings survive edits.
 */
export function parseMemory(source) {
  const entries = [];
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const match = line.match(
      /^\s*[-*]\s*\[([a-z]+)\]\s*(.+?)\s*(?:_\((\d{4}-\d{2}-\d{2})\)_)?\s*$/i,
    );
    if (!match) continue;
    const text = normalise(match[2]);
    if (!text) continue;
    entries.push({
      tag: match[1].toLowerCase(),
      text,
      date: match[3] ?? 'undated',
    });
  }
  return entries;
}


/**
 * Render one memory entry in the canonical Markdown form used by the file and by recall output.
 */
export function formatEntry(entry) {
  return `- [${entry.tag}] ${entry.text} _(${entry.date})_`;
}

/**
 * File-backed memory store. Every method re-reads the file, so hand edits are visible immediately; there is no cache to drift.
 */
export class Memory {
  constructor({
    root,
    file,
    maxEntries = 60,
    maxEntryChars = 300,
    rememberChars = 2000,
    promptChars = 1200,
    promptEntries = 12,
    now = () => new Date(),
  } = {}) {
    this.root = path.resolve(root ?? process.cwd());
    this.file = path.isAbsolute(file ?? '')
      ? path.resolve(file)
      : path.resolve(this.root, file ?? 'src/memory.md');
    this.label =
      path.relative(this.root, this.file).split(path.sep).join('/') ||
      path.basename(this.file);
    this.options = {
      maxEntries,
      maxEntryChars,
      rememberChars,
      promptChars,
      promptEntries,
    };
    this.now = now;
  }


  /**
   * Read the memory file, returning an empty string when it does not exist or cannot be read. Memory should never break a run.
   */
  readRaw() {
    try {
      return fs.existsSync(this.file) ? fs.readFileSync(this.file, 'utf8') : '';
    } catch {
      return '';
    }
  }

  header(raw = this.readRaw()) {
    return raw
      .split(/\r?\n/)
      .filter((line) => !/^\s*[-*]\s*\[[a-z]+\]/i.test(line))
      .join('\n')
      .replace(/\s+$/, '');
  }


  /**
   * Parse and return all current entries.
   */
  entries() {
    return parseMemory(this.readRaw());
  }


  /**
   * Write entries back while preserving the file header. Creates the directory if needed.
   */
  save(entries) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const header = this.header();
    const body = entries.map(formatEntry).join('\n');
    const text = header ? `${header}\n\n${body}\n` : `${body}\n`;
    fs.writeFileSync(this.file, text, 'utf8');
  }


  /**
   * Add a tagged note, capped by length and count. An identical note refreshes its date and tag instead of creating a duplicate. Oldest entries are evicted first.
   */
  remember(rawText, { tag = 'fact' } = {}) {
    const text = normalise(rawText).slice(0, this.options.rememberChars);
    if (!text) return { ok: false, error: 'empty' };

    const cleanTag = TAGS.has(String(tag).toLowerCase())
      ? String(tag).toLowerCase()
      : 'fact';
    const entry = {
      tag: cleanTag,
      text: text.slice(0, this.options.maxEntryChars),
      date: dateStamp(this.now()),
    };

    // Deduplicate by text so repeated lessons refresh a note instead of filling the file.
    const entries = this.entries();
    const existing = entries.findIndex(
      (item) => item.text.toLowerCase() === entry.text.toLowerCase(),
    );
    if (existing !== -1) {
      entries[existing] = { ...entries[existing], date: entry.date, tag: entry.tag };
      this.save(entries);
      return { ok: true, duplicate: true, entry: entries[existing], total: entries.length };
    }

    entries.push(entry);
    // Bound the file: evict the oldest entries once the cap is exceeded.
    const dropped = Math.max(0, entries.length - this.options.maxEntries);
    if (dropped) entries.splice(0, dropped);
    this.save(entries);
    return { ok: true, duplicate: false, entry, dropped, total: entries.length };
  }


  /**
   * Remove every entry whose text contains the given substring. Returns the number removed.
   */
  forget(match) {
    const needle = normalise(match).toLowerCase();
    if (!needle) return 0;
    const entries = this.entries();
    const kept = entries.filter((item) => !item.text.toLowerCase().includes(needle));
    const removed = entries.length - kept.length;
    if (removed) this.save(kept);
    return removed;
  }


  /**
   * Search newest-first for entries containing every query word. An empty query returns the newest entries, subject to the limit.
   */
  search(query, { limit = 20 } = {}) {
    const words = normalise(query).toLowerCase().split(' ').filter(Boolean);
    const entries = this.entries().slice().reverse();
    const hits = entries.filter((entry) => {
      const haystack = `${entry.tag} ${entry.text}`.toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    return hits.slice(0, Math.max(0, limit));
  }


  /**
   * Build the compact, newest-first memory slice injected into the system prompt. It respects a character budget and tells the model how many older memories were hidden.
   */
  digest({ entries, chars } = {}) {
    const all = entries ?? this.entries();
    if (all.length === 0) return '';

    const limit = chars ?? this.options.promptChars;
    // Inject newest-first, bounded by both entry count and character budget.
    const newest = all.slice().reverse().slice(0, this.options.promptEntries);
    const lines = [];
    let used = 0;
    let shown = 0;

    for (const entry of newest) {
      const line = formatEntry(entry);
      if (shown > 0 && used + line.length + 1 > limit) break;
      if (line.length > limit) {
        lines.push(line.slice(0, limit));
        used = limit;
        shown += 1;
        break;
      }
      lines.push(line);
      used += line.length + 1;
      shown += 1;
    }

    // Tell the model that older memories exist; recall can fetch them.
    const hidden = all.length - shown;
    let out = lines.join('\n');
    if (hidden > 0) {
      out += `\n(${hidden} older ${hidden === 1 ? 'memory' : 'memories'} not shown - search ${this.label} with the recall tool)`;
    }
    return out;
  }


  /**
   * One-line description of the memory file: entry count and newest date, used by the banner.
   */
  summary() {
    const entries = this.entries();
    const count = entries.length;
    if (count === 0) return `${this.label} (0 memories)`;
    const newest = entries[entries.length - 1]?.date;
    return `${this.label} (${count} ${count === 1 ? 'memory' : 'memories'}, newest ${newest})`;
  }
}

export default Memory;
