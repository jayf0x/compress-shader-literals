# Vendored rules

Copied verbatim from [semgrep-rules](https://github.com/semgrep/semgrep-rules)
`typescript/react/security/audit/` — hand-picked for what this repo actually does
(renders arbitrary children, no auth/JWT/axios/i18n/styled-components/react-markdown,
so those rule families were dropped as dead weight, not just left disabled):

- `react-dangerouslysetinnerhtml.yaml` — taints `dangerouslySetInnerHTML` from props.
- `react-unsanitized-method.yaml` — taints `document.write`/`insertAdjacentHTML`.
- `react-unsanitized-property.yaml` — taints `ref.innerHTML`/`outerHTML` assignment.
- `react-href-var.yaml` — taints variable `href` values (`javascript:` URI risk).

Skipped on purpose: `react-props-spreading` fires on this library's core pattern
(`<GridItem {...spanProps} />` etc.) — not a real finding here, just noise.
`best-practice`/legacy-lifecycle/`i18next`/jwt/insecure-request/styled-components
rules don't apply — nothing in this codebase does those things.

Re-sync with `config/opengrep/sync-rules.sh` (needs a local `semgrep-rules` checkout;
edit the file list there if you want to add/drop a rule).
