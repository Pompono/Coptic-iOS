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
