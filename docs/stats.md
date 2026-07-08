# How the stats are measured

The numbers in the README come from [`tests/e2e.js`](../tests/e2e.js), run against real published packages that ship their own shaders. The mechanics are commented in that file — this page is about what the numbers mean.

## What we're actually claiming

**Saved** is this tool's own contribution: real shader bytes stripped from real libraries, before any other compression touches them.

**Net after Brotli** answers the honest follow-up: "doesn't a compressor already do this for me on the wire?" It's the same comparison, but both sides are Brotli-compressed first. A positive number means this tool still shrinks the payload after Brotli has done its usual job — the number a CDN can't already claim credit for.

We don't report Gzip separately — it tracks close behind Brotli, and a second near-identical column wouldn't add information. We also only compute this for the top 5 packages by raw savings (the rest show `—`): Brotli-compressing every package in the corpus is real CPU time for a number that, past the top savers, isn't telling you anything new.

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
