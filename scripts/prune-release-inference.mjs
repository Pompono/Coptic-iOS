import { rm } from 'node:fs/promises';

// Remove only generated release copies, never developers' source model files or
// exporter/evaluation tools. Capacitor sync copies this final out/ directory.
for (const directory of ['out/models/coptic-english', 'out/local-runtime']) {
  await rm(directory, { recursive: true, force: true });
}
console.log('Release export excludes local translation weights and ONNX runtime; OCR assets are retained.');
