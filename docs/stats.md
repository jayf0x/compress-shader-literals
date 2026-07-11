# How the stats are measured

The numbers in the README come from [`tests/e2e.js`](../tests/e2e.js), run against real published packages that ship their own shaders. The mechanics are commented in that file — this page is about what the numbers mean.

## What we're actually claiming

**Saved** answers: "how much smaller is the shader source itself, right after minifying it?" Take the shader text before and after, compare the file sizes. This is the tool's own, direct contribution — before anything else (bundler, server, browser) does any compression on top.

**Net after Brotli** answers the honest follow-up: "does this still matter once the file gets compressed for the wire anyway?" Nearly every real deployment serves assets Brotli- or gzip-compressed, and compression already squeezes out a lot of the same redundancy minifying does (long runs of spaces, repeated code patterns). So instead of comparing the _plain_ before/after text, this column compresses both sides with Brotli first, and _then_ compares the sizes. A positive number means the minified version is still smaller after compression — real savings a CDN doesn't already give you for free.

We don't report Gzip separately — it tracks close behind Brotli, and a second near-identical column wouldn't add information.

### Why "Net after Brotli" isn't just a shrunk-down version of "Saved"

These two numbers can look inconsistent at a glance — a package with a _modest_ raw "Saved" percentage can post a much _bigger_ "Net after Brotli" percentage, which seems backwards ("shouldn't compression only shrink my win, never grow it?"). It's not a bug — the two percentages measure different things and there's no rule tying one to the other:

- **Saved** compares plain-text byte counts.
- **Net after Brotli** compares _compressed_ byte counts, computed as an entirely separate before/after pair.

What actually gets removed by minifying explains the gap. Two very different things get stripped: whitespace, and comments.

- **Whitespace** (indentation, blank lines, spaces around punctuation) is highly repetitive — exactly what a compressor is built to squash. Removing it saves real bytes in the plain-text count, but Brotli was already encoding all those repeated spaces almost for free. So this part of the savings barely shows up in the "after Brotli" comparison — compression already had it covered.
- **Comments** are hand-written, one-of-a-kind sentences. A compressor has nothing to pattern-match them against, so they're expensive to keep around in the compressed output relative to their plain-text size. Removing them barely dents the plain-text byte count, but shrinks the compressed output disproportionately.

So a package whose shaders lean comment-heavy (rather than whitespace-heavy) will show a smaller "Saved" number and a larger "Net after Brotli" number — the bytes minifying removed there were "cheap" to strip in plain text but "expensive" to carry through compression. Nothing to worry about; it's just telling you _what kind_ of bytes that package's shaders wasted.

## Why real packages, not synthetic ones

Every shader in the benchmark is scraped out of installed npm packages, not hand-written for the demo. That also means it's an engine benchmark, not what the plugin does by default: these libraries don't tag their shaders, and the plugin only touches **tagged** literals unless you widen `include`/`exclude` yourself. See [AGENTS.md](../AGENTS.md) for the tagging rules.

## Validity

Nothing in this benchmark is allowed to silently break a shader. Every result is parsed before and after minify with a real parser for its dialect (GLSL and WGSL both have one), or structurally checked where no parser can make sense of the fragment — and the run fails hard if minify corrupts anything that used to work.

## Reproduce

```sh
cd tests && bun install
node e2e.js            # print the table
node e2e.js --write    # update the README table
```
