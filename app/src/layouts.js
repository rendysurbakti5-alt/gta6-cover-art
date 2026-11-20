// Panel layouts for the poster. Every layout is a list of panels in normalised
// poster coordinates (0..1 on both axes), so the same composition renders at
// 1080 x 1080, 1080 x 1350 and 1920 x 1080 without change. A panel is a polygon:
// four or more [x, y] corners, clockwise. Rectangles are four-corner polygons,
// which lets the diagonal layout share the same drawing code as the grids.

function rect(x0, y0, x1, y1) {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

// The classic four-way split: equal quarters, the safest poster grid.
const quadGrid = [
  rect(0, 0, 0.5, 0.5),
  rect(0.5, 0, 1, 0.5),
  rect(0, 0.5, 0.5, 1),
  rect(0.5, 0.5, 1, 1),
];

// One tall hero panel on the left, two stacked panels on the right.
const heroLeft = [
  rect(0, 0, 0.62, 1),
  rect(0.62, 0, 1, 0.5),
  rect(0.62, 0.5, 1, 1),
];

// Three full-height columns, like a fold-out magazine cover.
const triptych = [
  rect(0, 0, 1 / 3, 1),
  rect(1 / 3, 0, 2 / 3, 1),
  rect(2 / 3, 0, 1, 1),
];

// A wide cinematic panel on top, three smaller panels in a strip beneath it.
const cinemaStrip = [
  rect(0, 0, 1, 0.56),
  rect(0, 0.56, 1 / 3, 1),
  rect(1 / 3, 0.56, 2 / 3, 1),
  rect(2 / 3, 0.56, 1, 1),
];

// A slanted divider running from top to bottom: one tall panel on the left,
// two panels stacked on the right of the slant.
const diagonalCut = [
  [[0, 0], [0.72, 0], [0.55, 0.5], [0.38, 1], [0, 1]],
  [[0.72, 0], [1, 0], [1, 0.5], [0.55, 0.5]],
  [[0.55, 0.5], [1, 0.5], [1, 1], [0.38, 1]],
];

// Five panels: a centre hero framed by a top strip, a bottom strip and a
// smaller scene on each side.
const heroFrame = [
  rect(0.27, 0.22, 0.73, 0.78),
  rect(0, 0, 1, 0.22),
  rect(0, 0.78, 1, 1),
  rect(0, 0.22, 0.27, 0.78),
  rect(0.73, 0.22, 1, 0.78),
];

export const LAYOUTS = [
  { id: 'hero', name: 'Hero', panels: heroLeft },
  { id: 'quad', name: 'Quad', panels: quadGrid },
  { id: 'triptych', name: 'Triptych', panels: triptych },
  { id: 'strip', name: 'Cinema Strip', panels: cinemaStrip },
  { id: 'diagonal', name: 'Diagonal', panels: diagonalCut },
  { id: 'frame', name: 'Hero Frame', panels: heroFrame },
];

export function layoutById(id) {
  return LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];
}

// The axis-aligned box a polygon sits in: photos are cover-fitted to this box,
// then clipped to the polygon itself.
export function polygonBounds(points) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Even-odd point test used to hit-test panel clicks on the preview canvas.
export function pointInPolygon(points, px, py) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const crosses = (yi > py) !== (yj > py);
    if (crosses && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
