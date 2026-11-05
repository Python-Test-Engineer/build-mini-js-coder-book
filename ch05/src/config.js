/**
 * config.js - load settings and explain where every value came from.
 *
 * Precedence is deliberate and visible: command-line flags beat the shared
 * .env file, which beats the shell environment, which beats defaults. The
 * returned object carries provenance (apiKeySource, modelSource, envFile) so
 * the banner can answer the reader's first debugging question: "which key and
 * model is this run actually using?"
 *
 * The .env file is found by walking up from the project root. That is why the
 * chapters share one repository-root .env instead of carrying 17 copies.
 */

import fs from 'node:fs';
import path from 'node:path';


/**
 * The chapter folder is the project root. All relative configuration and memory paths resolve from here.
 */
export const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');


/**
 * The fallback model when neither .env nor a flag supplies one.
 */
export const DEFAULT_MODEL = 'deepseek/deepseek-v4.1-flash-1017';


/**
 * A small, visible mapping from common model families to OpenRouter vendor prefixes. Unknown families are left unchanged.
 */
const VENDOR_BY_PREFIX = new Map([
  ['deepseek', 'deepseek'],
  ['claude', 'anthropic'],
  ['gpt', 'openai'],
  ['o1', 'openai'],
  ['o3', 'openai'],
  ['o4', 'openai'],
  ['chatgpt', 'openai'],
  ['gemini', 'google'],
  ['grok', 'x-ai'],
  ['llama', 'meta-llama'],
  ['qwen', 'qwen'],
  ['mistral', 'mistralai'],
  ['mixtral', 'mistralai'],
]);


/**
 * Walk up from startDir until a .env file is found. Nearest file wins, which lets a chapter share the repository-root .env without embedding credentials in every folder.
 */
export function findEnvFile(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}


/**
 * Parse the small, forgiving subset of .env syntax the harness supports: comments, optional export, quoted values and trailing comments. Blank values are ignored rather than treated as secrets.
 */
export function loadDotEnv(file) {
  if (!file || !fs.existsSync(file)) return {};
  const out = {};
  let source = '';
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  for (const rawLine of source.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice('export '.length).trim();
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    if (value === '') continue; // blank values are ignored
    out[key] = value;
  }
  return out;
}


/**
 * Show enough of a secret to recognise it (first five and last four characters) without printing the whole key. This is what the banner displays.
 */
export function fingerprint(secret) {
  if (!secret) return 'not set';
  const text = String(secret);
  if (text.length <= 12) return '*'.repeat(text.length);
  return `${text.slice(0, 5)}...${text.slice(-4)} (${text.length} chars)`;
}


/**
 * Turn a bare model family name such as "claude-sonnet" into an OpenRouter vendor/model slug when the vendor is obvious. Unknown names are left alone so the user can see the guess that was made.
 */
export function normalizeModel(name) {
  const text = String(name ?? '').trim();
  if (!text) return DEFAULT_MODEL;
  if (text.includes('/')) return text;
  const prefix = text.split(/[-_.:]/)[0].toLowerCase();
  const vendor = VENDOR_BY_PREFIX.get(prefix);
  return vendor ? `${vendor}/${text}` : text;
}

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};


/**
 * The only valid CMD_POLICY values. Anything else falls back to ask.
 */
const POLICY = new Set(['allow', 'ask', 'deny']);


/**
 * Build the final configuration object and record where each value came from. Precedence: flags > .env > shell environment > defaults. Numeric settings are clamped so a bad value cannot create an unusable run.
 */
export function loadConfig(overrides = {}, { envFile, startDir = PROJECT_ROOT } = {}) {
  const file = envFile === undefined ? findEnvFile(startDir) : envFile;
  const fileVars = file ? loadDotEnv(file) : {};

  const pick = (...names) => {
    for (const name of names) {
      if (Object.hasOwn(fileVars, name)) {
        return { value: fileVars[name], source: 'env' };
      }
    }
    for (const name of names) {
      if (process.env[name] !== undefined && process.env[name] !== '') {
        return { value: process.env[name], source: 'shell' };
      }
    }
    return null;
  };

  const key = pick('OPENROUTER_API_KEY', 'OPENROUTER_KEY');
  const apiKey = key?.value ?? null;
  const apiKeySource = key?.source ?? 'unset';
  const shellKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENROUTER_KEY;
  const apiKeyOverrodeShell =
    apiKeySource === 'env' && shellKey !== undefined && shellKey !== apiKey;

  const baseModel = pick('OPENROUTER_MODEL', 'MODEL');
  let modelRaw = baseModel?.value ?? DEFAULT_MODEL;
  let modelSource = baseModel?.source ?? 'default';
  const defaultedModel = !baseModel;
  if (overrides.model !== undefined && String(overrides.model).trim() !== '') {
    if (String(overrides.model) !== modelRaw) {
      modelRaw = String(overrides.model);
      modelSource = 'flag';
    }
  }
  const model = normalizeModel(modelRaw);
  const modelNormalised = model !== modelRaw;

  const policyPick = pick('CMD_POLICY');
  let commandPolicy = String(
    overrides.commandPolicy ?? policyPick?.value ?? 'ask',
  ).toLowerCase();
  if (!POLICY.has(commandPolicy)) commandPolicy = 'ask';

  const maxSteps = Math.max(
    1,
    toInt(overrides.maxSteps ?? pick('MAX_STEPS')?.value, 12),
  );
  const requestTimeoutMs = Math.max(
    1000,
    toInt(pick('REQUEST_TIMEOUT_MS')?.value, 90_000),
  );

  // Workspace and memory paths are resolved from the project root, not the current shell directory.
  const workspaceSetting = pick('WORKSPACE_DIR')?.value ?? 'workspace';
  const workspaceRoot = path.isAbsolute(workspaceSetting)
    ? workspaceSetting
    : path.resolve(PROJECT_ROOT, workspaceSetting);

  const memorySetting = pick('MEMORY_FILE')?.value ?? 'src/memory.md';
  const memoryFile = path.isAbsolute(memorySetting)
    ? memorySetting
    : path.resolve(PROJECT_ROOT, memorySetting);

  return {
    projectRoot: PROJECT_ROOT,
    apiKey,
    apiKeySource,
    apiKeyOverrodeShell,
    fingerprint: fingerprint(apiKey),
    model,
    modelSource: defaultedModel && modelSource === 'default' ? 'default' : modelSource,
    modelNormalised,
    envFile: file ?? null,
    commandPolicy,
    maxSteps,
    requestTimeoutMs,
    workspaceRoot,
    memoryFile,
    memoryMaxEntries: Math.max(1, toInt(pick('MEMORY_MAX_ENTRIES')?.value, 60)),
    memoryPromptChars: Math.max(1, toInt(pick('MEMORY_PROMPT_CHARS')?.value, 1200)),
  };
}

export default loadConfig;
