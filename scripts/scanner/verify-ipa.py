"""Verify the uploaded device archive actually contains the offline OCR/content without local AI inference."""
import hashlib
import json
import plistlib
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    root = 'Payload/App.app/'
    info = plistlib.loads(archive.read(root + 'Info.plist'))
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
    for name in archive.namelist():
        if not name.startswith(assets) or name.endswith('/'):
            continue
        assert '/local-runtime/' not in name and '/models/coptic-english/' not in name, 'Local AI assets must not ship'
        assert not name.endswith(('.onnx', '.onnx_data')), 'AI weights must not ship'
        data = archive.read(name)
        assert all(marker not in data for marker in (b'COPTIC_API_KEY', b'api.coptlingo.com', b'-----BEGIN PRIVATE KEY-----', b'-----BEGIN RSA PRIVATE KEY-----')), 'Forbidden private translation configuration; values withheld'
    print('PASS: IPA contains arm64 app, offline reader, dictionary, learning audio, published references and verified OCR; no local AI assets or private translation configuration.')
