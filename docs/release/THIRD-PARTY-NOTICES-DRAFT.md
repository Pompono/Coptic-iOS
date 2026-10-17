# Third-party materials — attribution and permission inventory (draft)

Status: **not a complete or legally approved third-party notices file**. Project identity intentionally omitted. Verify every source, artifact, copyright holder, source file, distribution form and applicable license before publication. Do not imply author approval/endorsement.

| Material | Source | Identified license / status | Required follow-up |
| --- | --- | --- | --- |
| Coptic OCR trained model `cop.traineddata` | https://github.com/Shreeshrii/tessdata_coptic (pinned revision 192d3199323afc34c66504c34ada837508a9ed07) | **No explicit model license established.** | Await maintainer clarification; do not bundle publicly without applicable permission or suitable replacement. Tesseract engine license does not grant rights in this model. |
| Tesseract.js and its WASM core | npm dependencies `tesseract.js`, `tesseract.js-core` | Separate license texts copied by `scripts/scanner/prepare.mjs` into `public/ocr/` | Audit these actual copied files, copyright and notice requirements. |
| Coptic-to-English offline model | https://huggingface.co/megalaa/coptic-english-translator | Upstream identifies **AGPL-3.0**; the repo bundles `scripts/local-translation/LICENSE.model.txt` | Review obligations for conversion/quantization, model/source availability, notices, iOS distribution and whether a separately negotiated license is needed. |
| English-to-Coptic server model | https://huggingface.co/megalaa/english-coptic-translator | Model listing identifies **AGPL-3.0** | Review network-service obligations, deployment and source-offer implications separately from app bundling. |
| Combined dictionary / Coptic Dictionary Online | https://github.com/KELLIA/dictionary and underlying https://zenodo.org/records/1004929 | Reported **CC BY-SA 4.0**; establish exact dataset identity/version, source-specific notices and adaptations | Add correct attribution, change notice, license link and ShareAlike compliance. |
| Bohairic dictionary `public/bohairic_dictionary.json` | Source **not established by file name alone** | **Unverified at row/source level**, particularly illustrative passages and English translations | Trace generation, original dataset license and each external text/translation source. |
| Published reference Coptic-English text | https://huggingface.co/datasets/megalaa/coptic-corpora ; `public/reference-translation/LICENSE.txt` | Dataset declares **CC BY 4.0**, source field Tasbeha | Existing bundled notice names dataset, source and JSON changes. Verify upstream chain of rights for original Coptic/English passages and preserve attribution. |
| JS/TS/Capacitor dependencies | `package.json`, `package-lock.json`, installed release dependencies | Mixed licenses; **not inventoried** | Generate an actual bundled dependency/software bill of materials and include required notices. |
| App art, lesson text, icons and other non-font media | Application repository | Ownership/provenance requires per-asset confirmation | Audit any copied images/icons; keep proof of original work or third-party permissions. |

## Already-present licensing support

- `public/reference-translation/LICENSE.txt` documents the declared CC BY 4.0 dataset and changes.
- `scripts/scanner/prepare.mjs` creates `public/ocr/SOURCE.txt`, and copies separate Tesseract component licenses.
- `scripts/local-translation/LICENSE.model.txt` contains AGPL-3.0 text for the model.

## Release gate

**No rights inferred from mere public availability.** Obtain written/recorded license resolution for OCR, trace dictionary and text data, and review AGPL-3.0 conditions with qualified counsel or an open-source compliance specialist before signed App Store distribution. Do not use this draft alone as the app's final acknowledgments page.
