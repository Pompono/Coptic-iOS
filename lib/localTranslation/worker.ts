import { env, pipeline } from '@huggingface/transformers';
import { prepareCoptic } from './preprocess.mjs';
import { checkTranslationInput, checkTranslationOutput } from './quality.mjs';

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
  try {
    checkTranslationInput(text);
    const input = prepareCoptic(text, dialect);
    translator ??= pipeline('text2text-generation', 'coptic-english', { device: 'wasm', dtype: 'q8', local_files_only: true });
    const translate = await translator;
    const encoded = translate.tokenizer(input, { return_tensor: false });
    if (encoded.input_ids.length > 512) {
      throw new Error('This passage is too long for the local model. Split it into shorter passages.');
    }
    const output = await translate(input, { max_new_tokens: 64, num_beams: 1, do_sample: false });
    const translation = output[0]?.generated_text?.trim();
    if (!translation) throw new Error('The local model did not return a translation.');
    checkTranslationOutput(translation);
    self.postMessage({ id, translation, dialect });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'On-device translation failed.' });
    // Failed model initialization must be retryable.
    const previous = translator;
    translator = null;
    await previous?.then(instance => instance.dispose()).catch(() => {});
  } finally { busy = false; }
};
