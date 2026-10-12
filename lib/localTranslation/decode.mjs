import { Tensor } from '@huggingface/transformers';
import { beamSearch } from './beamSearch.mjs';

export async function decodeTranslation(translator, input, { maxInputTokens = 128, maxNewTokens = 128 } = {}) {
  const encoded = translator.tokenizer(input);
  if (encoded.input_ids.dims.at(-1) > maxInputTokens) throw new Error('This sentence exceeds the local model’s trained length. Split it into shorter complete sentences; no partial translation has been accepted.');
  const model = translator.model;
  // This adapter is pinned to Transformers.js 3.8.1. Encode the source once;
  // each live hypothesis owns its decoder cache. WASM caches are CPU tensors.
  const prepared = await model._prepare_encoder_decoder_kwargs_for_generation({ model_inputs: encoded, generation_config: {} });
  const tokens = await beamSearch(async (tokens, cache) => {
    const next = cache ? [tokens.at(-1)] : tokens;
    const result = await model.forward({ ...prepared,
      decoder_input_ids: new Tensor('int64', BigInt64Array.from(next, BigInt), [1, next.length]),
      past_key_values: cache,
    });
    return { logits: result.logits.data.slice(-model.config.vocab_size), state: model.getPastKeyValues(result, cache) };
  }, { startToken: model.config.decoder_start_token_id, eosToken: model.config.eos_token_id,
    padToken: model.config.pad_token_id, width: 4, maxTokens: maxNewTokens });
  return translator.tokenizer.decode(tokens, { skip_special_tokens: true }).trim();
}
