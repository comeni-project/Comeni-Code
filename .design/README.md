# .design

The design canvas. **Everything except the two `.mjs` files and `tokens.json` is generated** — see
[`docs/design/`](../docs/design/README.md).

```bash
node .design/build_pages.mjs
```

| File | Role |
|---|---|
| `tokens.json` | the light and dark tokens, fonts and radii — read by the boards and by `apps/web` (`npm run tokens`) |
| `_identity.mjs` | shared pieces and the identity boards, drawn from `tokens.json` |
| `build_pages.mjs` | every page and `canvas.json` |
| `*.dc.html` | one artboard each — generated |
| `canvas.json` | layout on three pages (Learn, Studio, Identity) — generated |

Requires Node 22 or newer (JSON import attributes). No dependencies.
