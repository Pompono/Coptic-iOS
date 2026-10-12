# Model-only translation work

The reports call the translation model directly: published-text lookup is
bypassed. Source: megalaa/Coptic Corpora, dataset revision
5b836707150687b46667fc5a0a596e9f4b3cd11d, CC-BY-4.0. Source data/attribution
also accompanies the bundled reference library. Original model pretraining
overlap is unknown: these are not demonstrations of unseen-model accuracy.

`formatting-results.json` compares 20 published pairs with synthetic printed
marks and colon formatting. This is a formatting stress test, not real camera
accuracy. Removing all marks and punctuation raises average character overlap
(chrF) from 0.636 to 0.732, but introduces an earthquake into an amazement verse.
That candidate is rejected. Bohairic mark-only normalization preserves
punctuation and yields the correct amazement rendering in that example, but
other semantic errors remain. Sahidic mark processing is unchanged because it
was not evaluated here. Original displayed Coptic is never altered.

`compression-results.json` compares the existing per-tensor q8 model with
per-channel q8 compression on clean source text within the trained token window.
Results are mixed, including worsened names. The new compression is not shipped.

`adaptation-results.json` records a 120-step CPU LoRA experiment (rank 8, q/v
attention projections, batch 2, learning rate 5e-5, seed 42). 240 examples were
sampled from an eligible pool of 11,197. The entire Tasbeha test split is excluded
from adapter training by normalized Coptic key; conflicting English renderings
and overlength pairs are excluded. This improves some outputs but still gets
names and relationships wrong. Its weights are not shipped. Alleluia completeness
in the full-precision evaluation is already present in the baseline, so it must
not be attributed to adapter training.

## Shipped inference changes

- Model-only Bohairic input strips printed combining marks, keeping every base
  letter, punctuation and the user's original displayed text.
- Complete sentences/paragraphs are decoded separately; wrapped lines and poetic
  colons are kept together. Each source segment must fit the 128-token window
  used in the original model's training (`args.json` max_input_length=128).
- Every segment is checked before generation. No partial result is accepted when
  one segment is too long or fails quality checks. Output limit is 128 tokens.
- Progress reports identify the passage being translated. The user can review
  original Coptic and English per segment. Input editing is blocked during a
  request to prevent displaying an answer beside different input.
- Very short fragment/refrain-only outputs for long sources are rejected. This is
  a conservative length heuristic, not a semantic verifier. Repetition and OCR
  artifact guards remain in place.

Offline browser tests exercise two newly composed sentences outside published
lookup. That verifies model execution and these simple meanings, not reliable
arbitrary translation. All non-reference output remains an unverified AI draft.

## Reproducing experiments

`node scripts/translation-evaluation/run.mjs` produces the formatting comparison
using bundled old weights and explicit original decoder limits. Run
`marks-only.mjs` after it for the mark-only variant. For compression, prepare a
separate per-channel model under /tmp/coptic-per-channel-models/coptic-english,
then run `compare-quantization.mjs`. The output paths are under /tmp.

For adaptation, install CPU torch 2.6.0 and the adjacent Python requirements;
run `python scripts/translation-evaluation/adapt.py`. It downloads pinned public
base weights/corpus and saves experiments under ignored .model-adaptation.
There is no automatic deployment of adapted weights. Further model replacement
needs a larger curated, dialect-balanced evaluation with semantic review.

## Longer training and mobile export

A second CPU run used 1,200 updates at learning rate 1e-4 (2,400 sampled
examples, same disjoint adapter-training split). Full-precision evaluation
improved the grandmother/Lois clause and restored "filled with fear" in the
amazement verse. Other meanings remain wrong, such as the ending of the fasting
verse. Original Coptic/English proper-name spelling correspondence also needs
linguistic review; string matching alone is not a semantic verdict.

The ordinary q8 export did not preserve the name improvement. A per-channel
export retaining q/v attention projections at full precision added "Iconium"
where no place name appears in the source. Both exports were rejected for
shipping. The larger decoder files also raise untested phone memory/latency
concerns. The experiment is recorded in `extended-adaptation-results.json`.

Run `adapt.py --steps 1200 --learning-rate 0.0001 --run-name extended` to repeat
the training. `merge-adapter.py` creates a local merged model for ONNX evaluation.
The exporter accepts `--source`, `--intermediate`, `--destination`, and
`--adaptation-manifest`; its default original-model conversion is unchanged.
No training experiment or exported adapted weights are included in app assets.
