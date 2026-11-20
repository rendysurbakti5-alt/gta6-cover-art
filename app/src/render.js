// The poster renderer. drawCover paints the whole composition — panels,
// photos, colour grade, gutters, caption lettering — onto any 2D context at
// any pixel size, so the editor's preview and the exported PNG are the same
// drawing made by the same code.

import { layoutById, polygonBounds } from './layouts.js';
import { gradeById } from './grades.js';

const TITLE_FONT_STACK = '"Arial Narrow", "Liberation Sans Narrow", Impact, "DejaVu Sans Condensed", sans-serif';
const BODY_FONT_STACK = '"Segoe UI", "Liberation Sans", "DejaVu Sans", sans-serif';
const CONDENSE_X = 0.84; // horizontal squeeze that gives the lettering its poster cut

function tracePolygon(ctx, points, width, height) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x * width, y * height);
    else ctx.lineTo(x * width, y * height);
  });
  ctx.closePath();
}

// One panel: its photo cover-fitted to the panel's bounding box with the
// placement's pan and zoom, clipped to the panel's polygon, grade filter on.
function drawPanelPhoto(ctx, state, grade, panel, placement, width, height) {
  const bounds = polygonBounds(panel);
  const box = {
    x: bounds.x * width,
    y: bounds.y * height,
    w: bounds.w * width,
    h: bounds.h * height,
  };
  ctx.save();
  tracePolygon(ctx, panel, width, height);
  ctx.clip();
  const photo = state.photos[placement.photoIndex];
  if (!photo) {
    drawPlaceholder(ctx, box, grade, width, height);
    ctx.restore();
    return;
  }
  const img = photo.image;
  const coverScale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const scale = coverScale * placement.zoom;
  const drawnW = img.naturalWidth * scale;
  const drawnH = img.naturalHeight * scale;
  const slackX = Math.max(0, drawnW - box.w) / 2;
  const slackY = Math.max(0, drawnH - box.h) / 2;
  const dx = box.x + (box.w - drawnW) / 2 + placement.panX * slackX;
  const dy = box.y + (box.h - drawnH) / 2 + placement.panY * slackY;
  ctx.filter = grade.filter;
  ctx.drawImage(img, dx, dy, drawnW, drawnH);
  ctx.filter = 'none';
  ctx.restore();
}

// A panel with no photo yet: a dark graded gradient and a quiet invitation.
function drawPlaceholder(ctx, box, grade, width, height) {
  const fill = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  fill.addColorStop(0, '#2b2130');
  fill.addColorStop(1, grade.paper);
  ctx.fillStyle = fill;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.min(box.w, box.h) * 0.09;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = Math.max(2, height * 0.003);
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.7, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy - r * 0.7);
  ctx.lineTo(cx + r * 0.55, cy - r * 0.7);
  ctx.moveTo(cx, cy - r * 1.25);
  ctx.lineTo(cx, cy - r * 0.15);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 ${Math.round(height * 0.02)}px ${BODY_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADD A PHOTO', cx, cy + r * 1.5);
}

// The grade's wash: one gradient over every panel so separate photos read as
// a single piece of cover art, plus the dark band the lettering sits on.
function drawGradeWash(ctx, grade, width, height) {
  const wash = ctx.createLinearGradient(0, 0, width * 0.25, height);
  for (const [at, colour] of grade.washStops) wash.addColorStop(at, colour);
  ctx.save();
  ctx.globalCompositeOperation = grade.washMode;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const bandTop = height * 0.62;
  const band = ctx.createLinearGradient(0, bandTop, 0, height);
  for (const [at, colour] of grade.bandStops) band.addColorStop(at, colour);
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop, width, height - bandTop);

  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.42,
    width / 2, height / 2, Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.36)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

// Gutter lines between panels and the frame around the whole poster.
function drawGuttersAndFrame(ctx, layout, grade, width, height) {
  ctx.strokeStyle = grade.paper;
  ctx.lineWidth = Math.max(3, height * 0.009);
  ctx.lineJoin = 'round';
  for (const panel of layout.panels) {
    tracePolygon(ctx, panel, width, height);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = Math.max(1, height * 0.0016);
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, width - ctx.lineWidth * 2, height - ctx.lineWidth * 2);
}

// A five-pointed star path centred on (cx, cy), the studio badge's mark.
function traceStar(ctx, cx, cy, radius) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// The small studio furniture: a "presents" credit top-left and a ringed star
// badge top-right, both in the grade's accent so they belong to the artwork.
function drawStudioMarks(ctx, grade, width, height) {
  const margin = width * 0.035;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${Math.round(height * 0.006)}px`; } catch { /* older canvas: no tracking */ }
  ctx.font = `700 ${Math.round(height * 0.021)}px ${BODY_FONT_STACK}`;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText('VICEFRAME STUDIO PRESENTS', margin + 2, margin + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('VICEFRAME STUDIO PRESENTS', margin, margin);
  try { ctx.letterSpacing = '0px'; } catch { /* no-op */ }

  const r = height * 0.034;
  const cx = width - margin - r;
  const cy = margin + r;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fill();
  ctx.lineWidth = Math.max(2, height * 0.003);
  ctx.strokeStyle = grade.accent;
  ctx.stroke();
  traceStar(ctx, cx, cy, r * 0.58);
  ctx.fillStyle = grade.titleTop;
  ctx.fill();
  ctx.restore();
}

// The caption: a letterspaced tagline over a big condensed title. The title
// is fitted to the poster's width, then painted in layers — soft shadow, a
// heavy dark stroke, a vertical gradient fill and a top sheen — the way
// poster lettering is built.
function drawCaption(ctx, state, grade, width, height) {
  const title = (state.title || '').trim();
  const tagline = (state.tagline || '').trim();
  const cx = width / 2;
  ctx.save();
  ctx.translate(cx, 0);
  ctx.scale(CONDENSE_X, 1);
  ctx.translate(-cx, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  let titleSize = height * 0.115 * state.titleScale;
  if (title) {
    ctx.font = `900 ${titleSize}px ${TITLE_FONT_STACK}`;
    const measured = ctx.measureText(title).width * CONDENSE_X;
    const target = width * 0.93;
    if (measured > target) titleSize *= target / measured;
    ctx.font = `900 ${titleSize}px ${TITLE_FONT_STACK}`;
  }
  const titleBaseline = height * 0.945;

  if (tagline) {
    const tagSize = Math.max(height * 0.024, titleSize * 0.21);
    ctx.font = `700 ${tagSize}px ${BODY_FONT_STACK}`;
    try { ctx.letterSpacing = `${Math.round(tagSize * 0.42)}px`; } catch { /* older canvas: no tracking */ }
    const tagY = title ? titleBaseline - titleSize * 1.08 : height * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(tagline.toUpperCase(), cx, tagY + tagSize * 0.08);
    ctx.fillStyle = grade.accent;
    ctx.fillText(tagline.toUpperCase(), cx, tagY);
    try { ctx.letterSpacing = '0px'; } catch { /* no-op */ }
  }

  if (title) {
    const text = title.toUpperCase();
    ctx.font = `900 ${titleSize}px ${TITLE_FONT_STACK}`; // the tagline reset the font; set it again
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(text, cx, titleBaseline + titleSize * 0.07);
    // heavy stroke
    ctx.lineWidth = titleSize * 0.16;
    ctx.strokeStyle = '#150812';
    ctx.strokeText(text, cx, titleBaseline);
    // gradient fill
    const fill = ctx.createLinearGradient(0, titleBaseline - titleSize, 0, titleBaseline);
    fill.addColorStop(0, grade.titleTop);
    fill.addColorStop(1, grade.titleBottom);
    ctx.fillStyle = fill;
    ctx.fillText(text, cx, titleBaseline);
    // top sheen
    const sheen = ctx.createLinearGradient(0, titleBaseline - titleSize, 0, titleBaseline);
    sheen.addColorStop(0, 'rgba(255,255,255,0.5)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillText(text, cx, titleBaseline);
  }
  ctx.restore();
}

// The selection outline the editor draws around the active panel. Preview
// only: exports are drawn without it.
function drawSelection(ctx, layout, selectedPanel, grade, width, height) {
  const panel = layout.panels[selectedPanel];
  if (!panel) return;
  ctx.save();
  tracePolygon(ctx, panel, width, height);
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(2, height * 0.004);
  ctx.stroke();
  tracePolygon(ctx, panel, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, height * 0.0016);
  ctx.setLineDash([height * 0.012, height * 0.009]);
  ctx.stroke();
  ctx.restore();
}

// Paint the whole cover. options.selection draws the editor's panel outline.
export function drawCover(ctx, state, width, height, options = {}) {
  const layout = layoutById(state.layoutId);
  const grade = gradeById(state.gradeId);
  ctx.save();
  ctx.fillStyle = grade.paper;
  ctx.fillRect(0, 0, width, height);
  layout.panels.forEach((panel, index) => {
    drawPanelPhoto(ctx, state, grade, panel, state.placements[index], width, height);
  });
  drawGradeWash(ctx, grade, width, height);
  drawGuttersAndFrame(ctx, layout, grade, width, height);
  drawStudioMarks(ctx, grade, width, height);
  drawCaption(ctx, state, grade, width, height);
  if (options.selection) drawSelection(ctx, layout, state.selectedPanel, grade, width, height);
  ctx.restore();
}

// Render the cover at an exact export size into a fresh canvas and hand back
// its PNG blob. This is the one export path: what downloads is what the
// preview showed, at full resolution.
export function renderExportCanvas(state, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCover(canvas.getContext('2d'), state, width, height);
  return canvas;
}
