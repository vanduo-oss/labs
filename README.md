# vd-hex (VdHexGrid)

Experimental **interactive hex-grid** toolkit for the browser: canvas rendering, pan/zoom, hex selection, terrain helpers, and optional grid rotation. Shipped as **ES modules** with zero npm dependencies.

This repository is the **standalone source** for vd-hex: all modules, same layout as integrated in the Vanduo docs site.

## Layout

| File | Role |
|------|------|
| [`hex-grid.js`](./hex-grid.js) | `VdHexGrid` class — canvas grid, events, pan/zoom, terrain API |
| [`utils/hex-math.js`](./utils/hex-math.js) | Axial coordinates, pixel mapping, corners, neighbors, terrain metadata |

## Usage

Serve files over HTTP (ESM `import` does not work from `file://` in most browsers), or bundle with your tool of choice.

```javascript
import { VdHexGrid } from './hex-grid.js';

const grid = new VdHexGrid({
  element: document.getElementById('container'),
  canvas: document.getElementById('canvas'),
  size: 30,
  width: 15,
  height: 10,
  rotation: 0
});

grid.on('select', (hex) => {
  console.log(hex.q, hex.r);
});
```

## Live demo and docs

- **Interactive demo:** [Vanduo — Labs (vd-hex)](https://vanduo.dev/#labs) — scroll to **vd-hex Component**.

## Keeping in sync

The canonical copy used by the documentation build lives under the Vanduo docs tree (`docs/js/`). When you change vd-hex, update **either** this repo **or** docs first, then copy the two files so both stay aligned:

```bash
# Example: from the monorepo root, after editing docs/js
cp docs/js/hex-grid.js labs/hex-grid.js
cp docs/js/utils/hex-math.js labs/utils/hex-math.js
```

## License

MIT — see [LICENSE](./LICENSE).
