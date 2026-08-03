#!/usr/bin/env bun
/**
 * Writes the release notes for a new version: one `claude -p` call summarizes the commits since the
 * last tag and returns JSON, this script does all the file writing (deterministic, and the model
 * never touches anything but its own output).
 *
 * - `CHANGELOG.md` — a new `## <version> — <date>` section on top, existing entries untouched.
 * - `README.md`    — the top-3 table inside the `WHATSNEW` taglify block: new row on top, previous
 *                    two kept as-is.
 *
 * Usage: `bun scripts/npm/release-notes.ts 1.6.0`. Never fatal — a failed/missing `claude` just warns,
 * so a release is never blocked on it.
 */
import { $ } from 'bun';
import { taglRead, taglText } from 'taglify';

const CHANGELOG = './CHANGELOG.md';
const README = './README.md';

const version = process.argv[2];
if (!version) throw new Error('usage: bun scripts/npm/release-notes.ts <version>');

const warn = (msg: string) => console.warn(`! release notes skipped — ${msg}`);

// A hand-written entry for this version wins — it's already curated, and re-running the script
// (interrupted publish, dev case) must never duplicate or overwrite it.
const changelog = await Bun.file(CHANGELOG).text();
if (new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm').test(changelog)) {
  warn(`CHANGELOG.md already has a ${version} entry`);
  process.exit(0);
}

const prevTag = (await $`git describe --tags --abbrev=0`.nothrow().text()).trim();
const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
const commits = (await $`git log ${range} --format=%s --no-merges`.text()).trim();

if (!commits) {
  warn(`no commits since ${prevTag || 'the start'}`);
  process.exit(0);
}

const prompt = `Summarize an npm release of "git-gimme" (a giget-backed \`git gimme\` subcommand for downloading a single file or folder from a repo without a full clone).

New version: ${version}
Previous tag: ${prevTag || '(none)'}

Commits since ${prevTag || 'the start'}:
${commits}

Reply with ONLY a JSON object, no prose, no code fences:
{
  "changelog": ["bullet", "bullet"],
  "highlight": "one line, max 90 chars, for the README's top-3 table"
}

Rules:
- Only meaningful changes: features, bug fixes, breaking changes, perf. Lead a breaking change with "**Breaking:**".
- Skip commits that are only chore, release, deploy, dist, demo, docs, README, format, lint, CI or asset churn.
- Each bullet: one line, imperative, no trailing period-free rambling. Example: "Fix stretch growth on rows past nrRows."
- If nothing meaningful remains: {"changelog": ["Internal and tooling changes only."], "highlight": "Internal changes only"}
- The highlight is the single most user-visible thing in this release.`;

let raw: string;
try {
  raw = await $`claude --model haiku --no-session-persistence -p ${prompt}`.text();
} catch (error) {
  warn(`claude failed (${error})`);
  process.exit(0);
}

const match = raw.match(/\{[\s\S]*\}/);
let notes: { changelog: string[]; highlight: string };
try {
  notes = JSON.parse(match?.[0] ?? '');
  if (!notes.changelog?.length || !notes.highlight) throw new Error('missing fields');
} catch (error) {
  warn(`unparseable model output (${error}):\n${raw.slice(0, 400)}`);
  process.exit(0);
}

// ── CHANGELOG.md ─────────────────────────────────────────────────────────────
const date = new Date().toISOString().slice(0, 10);
const section = `## ${version} — ${date}\n\n${notes.changelog.map((b) => `- ${b}`).join('\n')}\n`;
const firstEntry = changelog.indexOf('\n## ');
if (firstEntry === -1) {
  await Bun.write(CHANGELOG, `${changelog.trimEnd()}\n\n${section}`);
} else {
  await Bun.write(CHANGELOG, `${changelog.slice(0, firstEntry + 1)}${section}\n${changelog.slice(firstEntry + 1)}`);
}

// ── README.md ────────────────────────────────────────────────────────────────
// The table is user-facing highlights, not a full version log — an internal-only release doesn't
// get a row (it'd just burn a highlight slot on nothing). Keep the two previous rows verbatim; the
// model only ever writes the new one. Any stale row for this same version is dropped rather than
// duplicated.
const isInternalOnly = notes.highlight.trim().toLowerCase() === 'internal changes only';
if (isInternalOnly) {
  console.log(`✓ release notes for ${version} written to CHANGELOG.md (internal-only, README table unchanged)`);
} else {
  const readme = await Bun.file(README).text();
  const rows = (taglRead(readme, 'WHATSNEW') ?? '')
    .split('\n')
    .filter((line: string) => line.trim().startsWith('| `') && !line.trim().startsWith(`| \`${version}\``));
  const table = [
    '| Version | Highlights |',
    '| ------- | ---------- |',
    `| \`${version}\` | ${notes.highlight} |`,
    ...rows.slice(0, 2),
  ].join('\n');
  taglText(readme, { WHATSNEW: table }).write(README);

  console.log(`✓ release notes for ${version} written to CHANGELOG.md + README.md`);
}
