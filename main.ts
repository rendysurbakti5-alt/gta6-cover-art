// ViceFrame — Cover Art Studio: the program that hands the entry in.
// The app itself is the static site under app/ (open app/index.html in a
// desktop browser, fully offline). This program copies app/ and screenshots/
// into the output directory and writes dossier.json there with the kit's
// vendored library, so the dossier is exactly the bytes the scorer rebuilds.
//
// Run it the way the grader does, with MAKEFUN_OUTPUT_DIR standing in for
// /output outside the grader:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Try the app locally with:  node serve.ts   (then http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own limits for this bounty, passed to the library so a hand-in
// that would break them fails here first instead of at the scorer.
const GATE_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outputDir, 'app'), { recursive: true });

const screenshotsDir = join(repoDir, 'screenshots');
if (existsSync(screenshotsDir)) {
  cpSync(screenshotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, GATE_LIMITS));
console.log(`handed in: app/ + screenshots/ + dossier.json -> ${outputDir}`);
