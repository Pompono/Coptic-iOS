"""Export the pinned Coptic->English model for offline Capacitor WebAssembly.

Tokenizer JSON follows the Transformers.js Marian format. Unlike its general
converter, encoding scores come only from the source SentencePiece model, and
unknown-token ID comes from the actual shared vocabulary. Original converter:
https://github.com/huggingface/transformers.js/blob/3.8.1/scripts/extra/marian.py
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

import torch
from transformers import AutoTokenizer
from optimum.exporters.onnx import main_export
from onnxruntime.quantization import quantize_dynamic, QuantType
from huggingface_hub import hf_hub_download

MODEL = 'megalaa/coptic-english-translator'
REVISION = 'c5ccdb3aabb93c9962a0ae6d7305abfe8895d91d'


def tokenizer_json(tokenizer):
    vocab = tokenizer.encoder
    scores = {tokenizer.spm_source.IdToPiece(i): tokenizer.spm_source.GetScore(i)
              for i in range(tokenizer.spm_source.GetPieceSize())}
    specials = tokenizer.all_special_tokens
    eos = tokenizer.eos_token
    return {
        'version': '1.0', 'truncation': None, 'padding': None,
        'added_tokens': [dict(id=vocab[x], special=True, content=x,
                              single_word=False, lstrip=False, rstrip=False,
                              normalized=False) for x in specials],
        'normalizer': {'type': 'Precompiled', 'precompiled_charsmap': None},
        'pre_tokenizer': {'type': 'Sequence', 'pretokenizers': [
            {'type': 'WhitespaceSplit'},
            {'type': 'Metaspace', 'replacement': '▁', 'add_prefix_space': True}]},
        'post_processor': {
            'type': 'TemplateProcessing',
            'single': [{'Sequence': {'id': 'A', 'type_id': 0}},
                       {'SpecialToken': {'id': eos, 'type_id': 0}}],
            'pair': [], 'special_tokens': {eos: {
                'id': eos, 'ids': [tokenizer.eos_token_id], 'tokens': [eos]}}},
        'decoder': {'type': 'Metaspace', 'replacement': '▁', 'add_prefix_space': True},
        'model': {'type': 'Unigram', 'unk_id': vocab[tokenizer.unk_token],
                  'vocab': [[x, 0.0 if x in specials else scores.get(x, -100000.0)]
                            for x in sorted(vocab, key=vocab.get)]},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reuse-export', action='store_true')
    parser.add_argument('--source', default=MODEL)
    parser.add_argument('--intermediate', default='.model-export')
    parser.add_argument('--destination', default='public/models/coptic-english')
    parser.add_argument('--adaptation-manifest')
    args = parser.parse_args()
    torch.set_num_threads(2)
    root = Path(__file__).resolve().parents[2]
    intermediate = root / args.intermediate
    destination = root / args.destination
    (destination / 'onnx').mkdir(parents=True, exist_ok=True)
    if not args.reuse_export:
        main_export(args.source, output=intermediate, task='text2text-generation-with-past',
                    opset=17, revision=REVISION if args.source == MODEL else None, do_validation=True)
    tokenizer = AutoTokenizer.from_pretrained(args.source, revision=REVISION if args.source == MODEL else None)
    for filename in ['config.json', 'generation_config.json', 'tokenizer_config.json', 'special_tokens_map.json']:
        shutil.copyfile(intermediate / filename, destination / filename)
    (destination / 'tokenizer.json').write_text(
        json.dumps(tokenizer_json(tokenizer), ensure_ascii=False), encoding='utf-8')
    for name in ['encoder_model', 'decoder_model_merged']:
        target = destination / 'onnx' / f'{name}_quantized.onnx'
        quantize_dynamic(intermediate / f'{name}.onnx', target,
                         weight_type=QuantType.QUInt8,
                         op_types_to_quantize=['MatMul', 'Gather'],
                         extra_options={'EnableSubgraph': True})
        print(f'{target.name}: {target.stat().st_size / 1e6:.1f} MB', flush=True)
    shutil.copyfile(root / 'scripts/local-translation/LICENSE.model.txt', destination / 'LICENSE.txt')
    # Preserve the upstream license notice alongside the derived model files.
    notice = Path(hf_hub_download(MODEL, 'README.md', revision=REVISION)).read_text(encoding='utf-8')
    (destination / 'UPSTREAM_README.md').write_text(notice, encoding='utf-8')
    (destination / 'SOURCE.txt').write_text(
        f'Model source and weights: https://huggingface.co/{MODEL}/tree/{REVISION}\n'
        f'License: AGPL-3.0 (see UPSTREAM_README.md).\n'
        'Conversion source: scripts/local-translation/export.py in this repository.\n', encoding='utf-8')
    adaptation = json.loads(Path(args.adaptation_manifest).read_text(encoding='utf-8')) if args.adaptation_manifest else None
    if adaptation:
        with (destination / 'SOURCE.txt').open('a') as notice_file:
            notice_file.write('These weights include an experimental local adaptation; see ADAPTATION.json and the repository training source.\n')
        (destination / 'ADAPTATION.json').write_text(json.dumps(adaptation, indent=2) + '\n', encoding='utf-8')
    files = {str(p.relative_to(destination)): {'bytes': p.stat().st_size,
             'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
             for p in destination.rglob('*') if p.is_file() and p.name != 'manifest.json'}
    (destination / 'manifest.json').write_text(json.dumps({
        'model': MODEL, 'revision': REVISION, 'license': 'AGPL-3.0',
        'format': 'onnx-q8', 'adaptation': adaptation, 'files': files}, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
