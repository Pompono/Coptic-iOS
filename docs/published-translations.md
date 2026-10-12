# Published-text translation

The default Coptic-to-English method is now **Published text**. It retrieves an
existing English rendering from the bundled parallel-text library; it does not
ask a model to invent English. **Experimental AI draft** is an explicit option
for passages outside reference coverage. The method label stays with the output.

The library contains 17,318 Bohairic source rows from the pinned
[megalaa/coptic-corpora](https://huggingface.co/datasets/megalaa/coptic-corpora)
Tasbeha splits, licensed CC-BY-4.0. Source rows include duplicate passages and
competing versions: this is not 17,318 unique audited translations. The current index accepts 12,051 distinct keys and excludes 207 conflicting keys. Attribution,
revision, input file hashes and source row identifiers are bundled with the app.
The preparation script uses a fixed revision and no model training.

Matching preserves every base letter. It ignores casing, printed punctuation,
spacing and combining marks (which the source corpus omits), and expands five
explicit conventional sacred-name spellings. Numbers, brackets, replacement
boxes, foreign text, missing letters and letter substitutions cannot be silently
removed to obtain a match. No fuzzy match or partial passage is accepted.
The app displays the matched canonical Coptic and the source row on request.

Keys with competing English text are excluded unless an explicit source-row
selection exists. The Mary/dove stanza has such a selection, retaining the
existing English rendering of `ⲛⲁⲛ` (for us). Other competing renderings are not
resolved by majority vote or AI. Selection provenance is in
`scripts/reference-translation/selections.json`.

Tests retrieve existing English for the photographed Mary/dove, flower/incense/
Jesse, and Aaron's rod passages. These are **reference retrieval tests**, not
held-out model accuracy tests. The earlier photo-inspired "daughter" working
transcription was wrong: the source stanza says flower of incense. The short
`ⲛⲑⲟ ⲧⲉ ⲧϣⲉⲣⲓ` decoder test remains a separate grammatical example.

Coverage is limited to whole supported Bohairic passages. This does not make
arbitrary Coptic translation reliable, certify every corpus rendering, or fix
OCR. Unmatched text returns an explicit unresolved result by default. Published
Sahidic coverage is not included. AI drafts still have known semantic failures.

## Scanner source-assisted letter review

**Find a published passage to check these letters** searches in a dedicated
worker, ranks text candidates, and shows at most three suggestions. It uses
trigram overlap to shortlist passages and edit distance to rank them. Scores
are spelling similarity, not correctness probabilities. Short/unrelated inputs
and passages whose letters already match a supported source have no suggestions.
The more permissive search can ignore unknown OCR symbols for proposing text;
exact translation acceptance still uses the strict matcher.

The user sees a crop of the original photographed block with context, and both
texts with changed characters highlighted. A checkbox confirming photo review
is required before **Use this published Coptic text** becomes available. Applying
it replaces only that block, clears its previous English output, preserves the
original OCR for **Restore recognised text**, and does not translate automatically.
Published spelling may omit printed marks. There is no promise that a suggested
passage matches a damaged photo; the user must verify it.

**Improve contrast before reading** is optional. It makes a recognition-only
grayscale copy, stretches robust luminance percentiles, and can invert light
letters on dark backgrounds. It preserves intermediate shades rather than
binarizing marks, leaves dimensions unchanged, and keeps the original color
photo for all review crops. It does not retrain the OCR model or automatically
correct chi, deskew a page, or separate bilingual columns. Crop the Coptic column
before recognition where needed. Accuracy gains on real photographs remain to
be measured.
