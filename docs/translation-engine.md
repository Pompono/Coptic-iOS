# Offline translation engine comparison

The previous engine used greedy decoding (`num_beams: 1`, 64 new tokens).
Transformers.js 3.8.1's generation loop contains an unfinished beam-search
implementation; changing `num_beams` alone does not implement branching.

The new engine expands four independent hypotheses, reuses one source encoding,
and retains a decoder key/value cache per hypothesis. It ranks completed
sequences by length-normalized log probability, excludes the padding token,
and uses an optimistic score bound to stop. It rejects unfinished generations
at the 96-token limit rather than showing a silently truncated passage.
No random sampling or memorized hymn substitutions are used.

Run `node scripts/local-translation/compare-engine.mjs` for a CPU comparison
using the bundled q8 model. `COPTIC_TEXT` selects another input. Optional
`COPTIC_MODEL_ROOT` and `COPTIC_DTYPE=fp32` permit a separately prepared
full-precision model; full-precision weights are not shipped. The checked-in
JSONL records this development comparison, not a population accuracy score.

Three short phrases have expected English checks. The two longer inputs are
photo-inspired working transcriptions, not verified gold Coptic. Changing a
letter or spacing can change the model's meaning, so these must not be treated
as proof of real-photo accuracy.

Observed improvement: `ⲛⲑⲟ ⲧⲉ ⲧϣⲉⲣⲓ` changes from "You are the Son" to
"You are the daughter". The longer Jesse example retains Jesse with beam
search, but still gives an incorrect verb. The Mary example still mistranslates
the dove phrase as years. Full precision and removing combining marks did not
resolve those errors in diagnostic runs, so neither change is shipped.

This is a decoder improvement, not a retrained model or a general accuracy fix.
Four hypotheses need more inference work than one; device latency and memory
must be checked. Chromium and WebKit smoke tests execute the actual bundled
WASM worker offline and assert the three short English meanings.
