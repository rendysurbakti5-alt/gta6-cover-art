// ViceFrame's entry point: build the editor, then — when the page was opened
// with a ?shot= scene — stage that scene for a screenshot. With no scene the
// app still opens with the two sample photos loaded, so the first thing a
// visitor sees is a finished cover they can start changing.

import { createEditor } from './editor.js';
import { prepareShot } from './shots.js';

const api = createEditor();
const params = new URLSearchParams(window.location.search);

prepareShot(api, params).catch((error) => {
  console.error('scene failed', error);
  window.__shotReady = true; // let a screenshot driver see the page as-is
});
