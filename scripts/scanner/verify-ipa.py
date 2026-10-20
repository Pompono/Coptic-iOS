"""Verify the uploaded unsigned device IPA contains branding and offline app assets."""
import hashlib
import argparse
import json
import plistlib
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--require-offline-model', action='store_true',
                    help='fail unless the optional on-device translation model is present')
parser.add_argument('ipa', help='unsigned iOS application archive to inspect')
args = parser.parse_args()

with zipfile.ZipFile(args.ipa) as archive:
    root = 'Payload/App.app/'
    info = plistlib.loads(archive.read(root + 'Info.plist'))
    assert info['CFBundleDisplayName'] == 'CoptLingo', 'Home Screen display name must be CoptLingo'
    assert info['CFBundleName'] == 'CoptLingo', 'Bundle name must be CoptLingo'
    assert info['CFBundleIdentifier'] == 'com.pompono.coptic', 'App identity must remain unchanged'
    assert any('com.pompono.coptic' in item.get('CFBundleURLSchemes', [])
               for entry in info.get('CFBundleURLTypes', []) for item in [entry]), 'Native auth callback URL scheme missing'
    alternate = info['CFBundleIcons']['CFBundleAlternateIcons']['CopticDark']
    assert alternate.get('CFBundleIconName') == 'CopticDark' or any('CopticDark' in name for name in alternate.get('CFBundleIconFiles', [])), 'Gold alternate icon must be registered'
    binary = archive.read(root + 'App')
    assert binary[:4] == b'\xcf\xfa\xed\xfe', 'Expected a 64-bit Mach-O device binary'
    assert int.from_bytes(binary[4:8], 'little') == 0x0100000C, 'Expected arm64'
    assets = root + 'public/'
    for name in ('a.wav', 'o.wav', 'correct-answer.wav', 'incorrect-answer.wav', 'lesson-complete.wav'):
        data = archive.read(assets + 'audio/learn/shared/' + name)
        assert data[:4] == b'RIFF' and len(data) > 1000, name
    archive.getinfo(assets + 'download-on-the-app-store-badge.svg')
    archive.getinfo(assets + 'read/index.html')
    archive.getinfo(assets + 'vocabulary/index.html')
    archive.getinfo(assets + 'bohairic_dictionary.json')
    archive.getinfo(assets + 'translator/scanner/index.html')
    reference_bytes = archive.read(assets + 'reference-translation/bohairic.json')
    reference = json.loads(reference_bytes)
    assert reference['version'] == 1 and len(reference['rows']) >= 17000
    source = json.loads(archive.read(assets + 'reference-translation/SOURCE.json'))
    assert source['license'] == 'CC-BY-4.0'
    assert source['revision'] == reference['revision']
    archive.getinfo(assets + 'reference-translation/LICENSE.txt')

    archive.getinfo(assets + 'ocr/worker.min.js')
    archive.getinfo(assets + 'ocr/tesseract-core-simd-lstm.wasm.js')
    manifest = json.loads(archive.read(assets + 'ocr/manifest.json'))
    model = archive.read(assets + 'ocr/cop.traineddata')
    assert hashlib.sha256(model).hexdigest() == manifest['sha256']
    translation_manifest = assets + 'models/coptic-english/manifest.json'
    has_offline_model = translation_manifest in archive.namelist()
    if args.require_offline_model:
        assert has_offline_model, 'Offline translation model is required for this IPA'
    if has_offline_model:
        translation = json.loads(archive.read(translation_manifest))
        for name, details in translation['files'].items():
            data = archive.read(assets + 'models/coptic-english/' + name)
            assert len(data) == details['bytes'], name
            assert hashlib.sha256(data).hexdigest() == details['sha256'], name
    model_status = 'and verified offline models' if has_offline_model else 'without the optional offline translation model'
    print(f'PASS: IPA contains an arm64 CoptLingo app, reader, vocabulary reviews, dictionary, scanner, published-text references, {model_status}.')
