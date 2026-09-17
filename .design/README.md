# .design

The design canvas. **Everything except the two `.mjs` files is generated** — see
[`docs/design/`](../docs/design/README.md).

```bash
node .design/build_pages.mjs
```

| File | Role |
|---|---|
| `_identity.mjs` | tokens, shared pieces, identity boards |
| `build_pages.mjs` | every page and `canvas.json` |
| `*.dc.html` | one artboard each — generated |
| `canvas.json` | layout on three pages (Learn, Studio, Identity) — generated |

Requires Node 18 or newer. No dependencies.
