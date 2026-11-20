// The editor: wires the page's controls to the cover state and keeps the
// preview canvas painted. All photo handling is local — files are read with
// object URLs and drawn from memory; nothing leaves the machine.

import { LAYOUTS, layoutById, polygonBounds, pointInPolygon } from './layouts.js';
import { GRADES, gradeById } from './grades.js';
import { createCoverState, applyLayout, addPhoto, removePhoto, exportSize } from './state.js';
import { drawCover, renderExportCanvas } from './render.js';

const PREVIEW_MAX_W = 940;
const PREVIEW_MAX_H = 660;

function el(id) {
  return document.getElementById(id);
}

// Load an image from a URL and resolve once it can be drawn.
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

// A tiny SVG sketch of a layout's panels for its picker button.
function layoutSketch(layout) {
  const polys = layout.panels
    .map((panel) => `<polygon points="${panel.map(([x, y]) => `${x * 44},${y * 30}`).join(' ')}"/>`)
    .join('');
  return `<svg viewBox="0 0 44 30" aria-hidden="true">${polys}</svg>`;
}

export function createEditor() {
  const state = createCoverState();
  applyLayout(state, state.layoutId);

  const canvas = el('previewCanvas');
  const ctx = canvas.getContext('2d');
  let activePhoto = -1; // the photo the photo-strip has selected
  let renderQueued = false;

  // ---- preview painting -------------------------------------------------

  function fitPreviewCanvas() {
    const size = exportSize(state);
    const scale = Math.min(PREVIEW_MAX_W / size.width, PREVIEW_MAX_H / size.height);
    canvas.width = Math.round(size.width * scale);
    canvas.height = Math.round(size.height * scale);
  }

  function render() {
    drawCover(ctx, state, canvas.width, canvas.height, { selection: true });
    syncPanelControls();
  }

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  // ---- photo strip --------------------------------------------------------

  function refreshPhotoStrip() {
    const strip = el('photoStrip');
    strip.innerHTML = '';
    state.photos.forEach((photo, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'thumb' + (index === activePhoto ? ' active' : '');
      button.title = photo.name;
      const img = document.createElement('img');
      img.src = photo.image.src;
      img.alt = photo.name;
      button.appendChild(img);
      button.addEventListener('click', () => {
        activePhoto = index;
        refreshPhotoStrip();
      });
      strip.appendChild(button);
    });
    el('photoEmpty').style.display = state.photos.length ? 'none' : 'block';
  }

  async function addPhotoFromUrl(url, name) {
    const image = await loadImage(url);
    activePhoto = addPhoto(state, image, name);
    refreshPhotoStrip();
    requestRender();
    return image;
  }

  async function addPhotoFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
      await addPhotoFromUrl(url, file.name);
    } catch {
      URL.revokeObjectURL(url);
      setStatus('That file could not be read as an image.');
    }
  }

  // ---- panel controls -----------------------------------------------------

  function selectedPlacement() {
    return state.placements[state.selectedPanel];
  }

  function syncPanelControls() {
    const placement = selectedPlacement();
    if (!placement) return;
    const photo = state.photos[placement.photoIndex];
    el('panelInfo').textContent = photo
      ? `Panel ${state.selectedPanel + 1} · ${photo.name}`
      : `Panel ${state.selectedPanel + 1} · empty`;
    el('zoomRange').value = String(placement.zoom);
    el('zoomValue').textContent = `${placement.zoom.toFixed(2)}×`;
  }

  function cyclePanelPhoto(step) {
    if (!state.photos.length) return;
    const placement = selectedPlacement();
    const count = state.photos.length;
    placement.photoIndex = ((placement.photoIndex + step) % count + count) % count;
    requestRender();
  }

  // ---- layout and grade pickers ------------------------------------------

  function buildLayoutPicker() {
    const row = el('layoutRow');
    for (const layout of LAYOUTS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'layoutBtn' + (layout.id === state.layoutId ? ' active' : '');
      button.dataset.layoutId = layout.id;
      button.innerHTML = `${layoutSketch(layout)}<span>${layout.name}</span>`;
      button.addEventListener('click', () => {
        applyLayout(state, layout.id);
        row.querySelectorAll('.layoutBtn').forEach((b) => b.classList.toggle('active', b === button));
        requestRender();
      });
      row.appendChild(button);
    }
  }

  function buildGradePicker() {
    const row = el('gradeRow');
    for (const grade of GRADES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gradeBtn' + (grade.id === state.gradeId ? ' active' : '');
      button.innerHTML = `<span class="swatch" style="background:${grade.swatch}"></span><span>${grade.name}</span>`;
      button.addEventListener('click', () => {
        state.gradeId = grade.id;
        row.querySelectorAll('.gradeBtn').forEach((b) => b.classList.toggle('active', b === button));
        requestRender();
      });
      row.appendChild(button);
    }
  }

  // ---- canvas interaction: select, pan, zoom ------------------------------

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function panelAt(px, py) {
    const layout = layoutById(state.layoutId);
    const nx = px / canvas.width;
    const ny = py / canvas.height;
    for (let i = layout.panels.length - 1; i >= 0; i--) {
      if (pointInPolygon(layout.panels[i], nx, ny)) return i;
    }
    return -1;
  }

  // The slack (in preview pixels) a placement's photo can slide by, used to
  // turn a pointer drag into a pan change.
  function panSlack(placement) {
    const layout = layoutById(state.layoutId);
    const bounds = polygonBounds(layout.panels[state.selectedPanel]);
    const boxW = bounds.w * canvas.width;
    const boxH = bounds.h * canvas.height;
    const photo = state.photos[placement.photoIndex];
    if (!photo) return { x: 0, y: 0 };
    const cover = Math.max(boxW / photo.image.naturalWidth, boxH / photo.image.naturalHeight);
    const drawnW = photo.image.naturalWidth * cover * placement.zoom;
    const drawnH = photo.image.naturalHeight * cover * placement.zoom;
    return { x: Math.max(0, drawnW - boxW) / 2, y: Math.max(0, drawnH - boxH) / 2 };
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    const hit = panelAt(point.x, point.y);
    if (hit === -1) return;
    state.selectedPanel = hit;
    const placement = selectedPlacement();
    drag = {
      startX: point.x,
      startY: point.y,
      panX: placement.panX,
      panY: placement.panY,
      slack: panSlack(placement),
    };
    canvas.setPointerCapture(event.pointerId);
    requestRender();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = canvasPoint(event);
    const placement = selectedPlacement();
    if (drag.slack.x > 0) placement.panX = clamp(drag.panX + (point.x - drag.startX) / drag.slack.x);
    if (drag.slack.y > 0) placement.panY = clamp(drag.panY + (point.y - drag.startY) / drag.slack.y);
    requestRender();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const point = canvasPoint(event);
    const hit = panelAt(point.x, point.y);
    if (hit !== -1) state.selectedPanel = hit;
    const placement = selectedPlacement();
    placement.zoom = Math.min(3, Math.max(1, placement.zoom * Math.exp(-event.deltaY * 0.0012)));
    requestRender();
  }, { passive: false });

  function clamp(value) {
    return Math.min(1, Math.max(-1, value));
  }

  // ---- export ---------------------------------------------------------------

  function setStatus(text) {
    el('exportStatus').textContent = text;
  }

  function exportPng(options = {}) {
    const size = exportSize(state);
    const exportCanvas = renderExportCanvas(state, size.width, size.height);
    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => {
        if (!blob) {
          setStatus('Export failed in this browser.');
          resolve(null);
          return;
        }
        if (state.exportedUrl) URL.revokeObjectURL(state.exportedUrl);
        state.exportedUrl = URL.createObjectURL(blob);
        const img = el('exportedImg');
        img.src = state.exportedUrl;
        el('exportedWrap').style.display = 'block';
        if (options.download !== false) {
          const link = document.createElement('a');
          link.href = state.exportedUrl;
          link.download = `viceframe-cover-${size.width}x${size.height}.png`;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
        setStatus(`Exported PNG · ${size.width} × ${size.height}`);
        resolve(state.exportedUrl);
      }, 'image/png');
    });
  }

  // ---- wiring -----------------------------------------------------------------

  function wireControls() {
    el('addPhotosBtn').addEventListener('click', () => el('fileInput').click());
    el('fileInput').addEventListener('change', async (event) => {
      for (const file of event.target.files) await addPhotoFromFile(file);
      event.target.value = '';
    });

    const stage = el('stage');
    stage.addEventListener('dragover', (event) => {
      event.preventDefault();
      stage.classList.add('dragging');
    });
    stage.addEventListener('dragleave', () => stage.classList.remove('dragging'));
    stage.addEventListener('drop', async (event) => {
      event.preventDefault();
      stage.classList.remove('dragging');
      for (const file of event.dataTransfer.files) {
        if (file.type.startsWith('image/')) await addPhotoFromFile(file);
      }
    });

    el('fillAllBtn').addEventListener('click', () => {
      if (activePhoto < 0) return;
      for (const placement of state.placements) placement.photoIndex = activePhoto;
      requestRender();
    });
    el('removePhotoBtn').addEventListener('click', () => {
      if (activePhoto < 0) return;
      removePhoto(state, activePhoto);
      activePhoto = Math.min(activePhoto, state.photos.length - 1);
      refreshPhotoStrip();
      requestRender();
    });

    el('titleInput').addEventListener('input', (event) => {
      state.title = event.target.value;
      requestRender();
    });
    el('taglineInput').addEventListener('input', (event) => {
      state.tagline = event.target.value;
      requestRender();
    });
    el('titleSizeRange').addEventListener('input', (event) => {
      state.titleScale = Number(event.target.value);
      requestRender();
    });

    el('zoomRange').addEventListener('input', (event) => {
      selectedPlacement().zoom = Number(event.target.value);
      requestRender();
    });
    el('prevPhotoBtn').addEventListener('click', () => cyclePanelPhoto(-1));
    el('nextPhotoBtn').addEventListener('click', () => cyclePanelPhoto(1));
    el('centerBtn').addEventListener('click', () => {
      const placement = selectedPlacement();
      placement.panX = 0;
      placement.panY = 0;
      requestRender();
    });

    el('sizeSelect').addEventListener('change', (event) => {
      state.sizeId = event.target.value;
      fitPreviewCanvas();
      requestRender();
    });
    el('exportBtn').addEventListener('click', exportPng);
  }

  buildLayoutPicker();
  buildGradePicker();
  wireControls();
  fitPreviewCanvas();
  render();
  refreshPhotoStrip();

  return {
    state,
    addPhotoFromUrl,
    exportPng,
    renderNow: render,
    setSize(sizeId) {
      state.sizeId = sizeId;
      el('sizeSelect').value = sizeId;
      fitPreviewCanvas();
      requestRender();
    },
    setGrade(gradeId) {
      state.gradeId = gradeId;
      el('gradeRow').querySelectorAll('.gradeBtn').forEach((b, i) => {
        b.classList.toggle('active', GRADES[i].id === gradeId);
      });
      requestRender();
    },
    setLayout(layoutId) {
      applyLayout(state, layoutId);
      el('layoutRow').querySelectorAll('.layoutBtn').forEach((b) => {
        b.classList.toggle('active', b.dataset.layoutId === layoutId);
      });
      requestRender();
    },
    gradeName() {
      return gradeById(state.gradeId).name;
    },
  };
}
