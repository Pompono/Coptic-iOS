import { env, pipeline } from '@huggingface/transformers';
import { prepareCoptic } from './preprocess.mjs';
import { checkTranslationInput, checkTranslationOutput } from './quality.mjs';
import { decodeTranslation } from './decode.mjs';
import { passageSegments } from './segments.mjs';

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';
env.useBrowserCache = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
// Serve the module as .js so Capacitor's iOS asset handler reliably assigns
// a JavaScript MIME type even on systems without a registered .mjs UTI.
env.backends.onnx.wasm.wasmPaths = {
  mjs: '/local-runtime/ort-wasm-simd-threaded.jsep.js',
  wasm: '/local-runtime/ort-wasm-simd-threaded.jsep.wasm',
};
let translator: Promise<any> | null = null;
let busy = false;
self.onmessage = async (event) => {
  const { id, text, dialect } = event.data;
  if (busy) { self.postMessage({ id, error: 'Wait for the current translation to finish.' }); return; }
  busy = true;
  let stage = 'validation';
  try {
    checkTranslationInput(text);
    const sources = passageSegments(text);
    const prepared = sources.map(source => prepareCoptic(source, dialect));
    stage = 'load';
    self.postMessage({ id, progress: 'Preparing on-device translation…' });
    translator ??= pipeline('text2text-generation', 'coptic-english', { device: 'wasm', dtype: 'q8', local_files_only: true });
    const translate = await translator;
    stage = 'validation';
    // Validate the whole request first, before returning any partial output.
    for (const input of prepared) if (translate.tokenizer(input, { return_tensor: false }).input_ids.length > 128)
      throw new Error('One sentence exceeds the local model’s trained length. Split it into shorter complete sentences. No partial translation has been accepted.');
    const segments = [];
    for (const [index, input] of prepared.entries()) {
      self.postMessage({ id, progress: `Translating passage ${index + 1} of ${sources.length}…` });
      stage = 'generation';
      const translation = await decodeTranslation(translate, input);
      if (!translation) throw new Error('The local model did not return a translation.');
      stage = 'quality';
      checkTranslationOutput(translation, sources[index]);
      segments.push({ text: sources[index], translation });
    }
    const translation = segments.map(segment => segment.translation).join('\n\n');
    checkTranslationOutput(translation, text);
    self.postMessage({ id, translation, dialect, method: 'experimental', segments });
  } catch (error) {
    // Expected input/quality refusals don't require reloading a healthy model.
    if (stage === 'load' || stage === 'generation') {
      const previous = translator; translator = null;
      await previous?.then(instance => instance.dispose()).catch(() => {});
    }
    self.postMessage({ id, error: error instanceof Error ? error.message : 'On-device translation failed.' });
  } finally { busy = false; }
};
