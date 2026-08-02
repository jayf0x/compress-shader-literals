#!/usr/bin/env bun
/**
 * Writes the release notes for a new version: one `claude -p` call summarizes the commits since the
 * last tag and returns JSON, this script does all the file writing (deterministic, and the model
 * never touches anything but its own output).
 *
 * - `changelog.md` — a new `## <version> — <date>` section on top, existing entries untouched.
 *
 * Usage: `bun scripts/npm/release-notes.ts 1.6.0`. Never fatal — a failed/missing `claude` just warns,
 * so a release is never blocked on it.
 */
import { $ } from 'bun';

const CHANGELOG = './changelog.md';

const version = process.argv[2];
if (!version) throw new Error('usage: bun scripts/npm/release-notes.ts <version>');

const warn = (msg: string) => console.warn(`! release notes skipped — ${msg}`);

// A hand-written entry for this version wins — it's already curated, and re-running the script
// (interrupted publish, dev case) must never duplicate or overwrite it.
const changelog = await Bun.file(CHANGELOG).text();
if (new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm').test(changelog)) {
  warn(`changelog.md already has a ${version} entry`);
  process.exit(0);
}

const prevTag = (await $`git describe --tags --abbrev=0`.nothrow().text()).trim();
const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
const commits = (await $`git log ${range} --format=%s --no-merges`.text()).trim();

if (!commits) {
  warn(`no commits since ${prevTag || 'the start'}`);
  process.exit(0);
}

const prompt = `Summarize an npm release of "compress-shader-literals" (a tiny build-time unplugin that strips comments and collapses whitespace in GLSL/WGSL shader template literals in JS/TS, for any bundler, with no runtime cost).

New version: ${version}
Previous tag: ${prevTag || '(none)'}

Commits since ${prevTag || 'the start'}:
${commits}

Reply with ONLY a JSON object, no prose, no code fences:
{
  "changelog": ["bullet", "bullet"]
}

Rules:
- Only meaningful changes: features, bug fixes, breaking changes, perf. Lead a breaking change with "**Breaking:**".
- Skip commits that are only chore, release, deploy, dist, demo, docs, README, backlog, format, prettier, gif, preview, lint, CI or asset churn.
- Each bullet: one line, imperative, no trailing period-free rambling. Example: "Fix stretch growth on rows past nrRows."
- If nothing meaningful remains: {"changelog": ["Internal and tooling changes only."]}`;

let raw: string;
try {
  raw = await $`claude --model haiku --no-session-persistence -p ${prompt}`.text();
} catch (error) {
  warn(`claude failed (${error})`);
  process.exit(0);
}

const match = raw.match(/\{[\s\S]*\}/);
let notes: { changelog: string[] };
try {
  notes = JSON.parse(match?.[0] ?? '');
  if (!notes.changelog?.length) throw new Error('missing fields');
} catch (error) {
  warn(`unparseable model output (${error}):\n${raw.slice(0, 400)}`);
  process.exit(0);
}

// ── changelog.md ────────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10);
const section = `## ${version} — ${date}\n\n${notes.changelog.map((b) => `- ${b}`).join('\n')}\n`;
const firstEntry = changelog.indexOf('\n## ');
if (firstEntry === -1) {
  await Bun.write(CHANGELOG, `${changelog.trimEnd()}\n\n${section}`);
} else {
  await Bun.write(CHANGELOG, `${changelog.slice(0, firstEntry + 1)}${section}\n${changelog.slice(firstEntry + 1)}`);
}

console.log(`✓ release notes for ${version} written to changelog.md`);
