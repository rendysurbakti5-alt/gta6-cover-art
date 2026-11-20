// Deterministic scenes for screenshots, chosen by the ?shot= query parameter.
// Each scene drives the real editor — loading the kit's sample photos, picking
// a layout and grade, exporting through the app's own export path — so a
// screenshot shows the app exactly as a person would find it. When a scene is
// ready, window.__shotReady is set so the screenshot driver knows to shoot.
//
//   ?shot=editor          the editor, samples loaded, wide size
//   ?shot=editor-neon     the editor again: diagonal layout, neon grade
//   ?shot=export          the exported 1920 x 1080 cover, shown full-screen
//   ?shot=export-portrait the exported 1080 x 1350 cover, shown full-screen

async function loadSamples(api, first, second) {
  await api.addPhotoFromUrl(`samples/${first}.jpg`, `${first}.jpg`);
  await api.addPhotoFromUrl(`samples/${second}.jpg`, `${second}.jpg`);
}

function showExportedFullScreen(url) {
  document.body.classList.add('shot-export');
  document.getElementById('shotExportImg').src = url;
}

export async function prepareShot(api, params) {
  const shot = params.get('shot');
  if (!shot) {
    await loadSamples(api, 'pier', 'boulevard');
    return;
  }

  if (shot === 'editor') {
    document.body.classList.add('shot-editor');
    await loadSamples(api, 'pier', 'boulevard');
    api.state.selectedPanel = 1;
  } else if (shot === 'editor-neon') {
    await loadSamples(api, 'boulevard', 'pier');
    api.setLayout('diagonal');
    api.setGrade('neon-nights');
    api.setSize('square');
    api.state.title = 'MIDNIGHT RUN';
    api.state.tagline = 'THE CITY NEVER SLEEPS · IT HUNTS';
    document.getElementById('titleInput').value = api.state.title;
    document.getElementById('taglineInput').value = api.state.tagline;
    api.state.selectedPanel = 0;
    // Keep the column scrollable in this scene and roll it to the end, so
    // this still shows the caption, panel and export cards the first
    // editor screenshot does not reach.
    const controls = document.getElementById('controls');
    controls.scrollTop = controls.scrollHeight;
  } else if (shot === 'export') {
    await loadSamples(api, 'pier', 'boulevard');
    // The pier photo fills two panels; frame the smaller one as a close-up
    // on the fisherman's face (panY positive slides the photo down, showing
    // its top) so the repeat reads as a deliberate second shot, not a copy.
    api.state.placements[2].zoom = 1.45;
    api.state.placements[2].panY = 0.55;
    api.setSize('wide');
    const url = await api.exportPng({ download: false });
    if (url) showExportedFullScreen(url);
  } else if (shot === 'export-portrait') {
    await loadSamples(api, 'boulevard', 'pier');
    api.setLayout('triptych');
    // Same treatment: tighten the third column onto the subject's face.
    api.state.placements[2].zoom = 1.25;
    api.state.placements[2].panX = 0.1;
    api.state.placements[2].panY = 0.5;
    api.setGrade('golden-hour');
    api.setSize('portrait');
    api.state.title = 'SINS OF SUMMER';
    api.state.tagline = 'EVERY SAINT HAS A PAST';
    const url = await api.exportPng({ download: false });
    if (url) showExportedFullScreen(url);
  }

  api.renderNow();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
