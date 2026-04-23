# vd-hex

Interactive canvas hex-grid component for Vanduo Labs, built on flat-top axial coordinates.

- Component version: {{COMPONENT_VERSION}}
- Live labs site: **https://labs.vanduo.dev**

### Quick Start

```javascript
import { VdHexGrid } from './hex-grid.js';

const grid = new VdHexGrid({
  element: document.getElementById('hex-demo-container'),
  canvas: document.getElementById('hex-demo'),
  size: 30,
  width: 15,
  height: 10,
  rotation: 0
});
```

### Features

- Pan/zoom controls with pointer-friendly canvas interactions.
- Axial coordinate helpers for tile lookup, neighbors, and geometry math.
- Runtime terrain assignment and random fill utilities.
- Selection events for interactive tools, map editors, and prototypes.
- Adjustable grid size, dimensions, and rotation.

### Notes

- The labs demo includes extra UI controls intended for experimentation.
- Serve `labs/` over HTTP (not `file://`) so docs and modules load correctly.
