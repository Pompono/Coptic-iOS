"""Verify the uploaded device archive actually contains the offline scanner assets."""
import hashlib
import json
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    root = 'Payload/App.app/'
    binary = archive.read(root + 'App')
    assert binary[:4] == b'\xcf\xfa\xed\xfe', 'Expected a 64-bit Mach-O device binary'
    assert int.from_bytes(binary[4:8], 'little') == 0x0100000C, 'Expected arm64'
    assets = root + 'public/'
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
    translation = json.loads(archive.read(assets + 'models/coptic-english/manifest.json'))
    for name, details in translation['files'].items():
        data = archive.read(assets + 'models/coptic-english/' + name)
        assert len(data) == details['bytes'], name
        assert hashlib.sha256(data).hexdigest() == details['sha256'], name
    print('PASS: IPA contains an arm64 app, reader, vocabulary reviews, dictionary, scanner, published-text references, and verified offline models.')
