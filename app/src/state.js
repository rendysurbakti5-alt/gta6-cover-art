// The cover's state: everything the renderer needs and the editor edits.
// Kept apart from the DOM so the same state drives the on-screen preview and
// the full-size export render.

import { layoutById } from './layouts.js';

export const EXPORT_SIZES = [
  { id: 'square', name: 'Square post', width: 1080, height: 1080 },
  { id: 'portrait', name: 'Portrait post', width: 1080, height: 1350 },
  { id: 'wide', name: 'Wide banner', width: 1920, height: 1080 },
];

// One panel's placement: which photo fills it and how that photo is framed.
// panX/panY run -1..1 across the slack the cover-fit leaves; zoom is 1..3.
export function freshPlacement(photoIndex) {
  return { photoIndex, panX: 0, panY: 0, zoom: 1 };
}

export function createCoverState() {
  return {
    photos: [], // [{ image: HTMLImageElement, name: string }]
    layoutId: 'hero',
    placements: [], // one freshPlacement per panel of the current layout
    selectedPanel: 0,
    gradeId: 'vice-sunset',
    title: 'NEON SUNSET',
    tagline: 'ONE CITY · NO MERCY',
    titleScale: 1, // 0.7..1.3 multiplier on the fitted title size
    sizeId: 'wide',
    exportedUrl: '', // object URL of the last exported PNG, '' before any export
  };
}

// Point the state's placements at a layout, keeping as much of the user's
// framing as survives the change: panels that still exist keep their photo
// and framing, new panels take the next photos round-robin.
export function applyLayout(state, layoutId) {
  const layout = layoutById(layoutId);
  const previous = state.placements;
  state.layoutId = layoutId;
  state.placements = layout.panels.map((_, index) => {
    if (previous[index]) return previous[index];
    const photoIndex = state.photos.length ? index % state.photos.length : -1;
    return freshPlacement(photoIndex);
  });
  if (state.selectedPanel >= layout.panels.length) state.selectedPanel = 0;
}

// Register a loaded photo and offer it to any panel still showing a
// placeholder; the first photo fills every panel, later photos spread out.
export function addPhoto(state, image, name) {
  state.photos.push({ image, name });
  const photoIndex = state.photos.length - 1;
  state.placements.forEach((placement, index) => {
    if (placement.photoIndex === -1) placement.photoIndex = photoIndex;
    else if (state.photos.length > 1 && index === photoIndex % state.placements.length) {
      placement.photoIndex = photoIndex;
    }
  });
  return photoIndex;
}

export function removePhoto(state, photoIndex) {
  state.photos.splice(photoIndex, 1);
  for (const placement of state.placements) {
    if (placement.photoIndex === photoIndex) placement.photoIndex = -1;
    else if (placement.photoIndex > photoIndex) placement.photoIndex -= 1;
  }
}

export function exportSize(state) {
  return EXPORT_SIZES.find((size) => size.id === state.sizeId) ?? EXPORT_SIZES[0];
}
